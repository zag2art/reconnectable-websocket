const defaultOptions = {
  debug: false,
  automaticOpen: true,
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  reconnectDecay: 1.5,
  timeoutInterval: 2000,
  maxReconnectAttempts: null,
  randomRatio: 3,
  binaryType: 'blob'
}

class ReconnectableWebSocket {
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  constructor (url, protocols = [], options = {}) {
    this._url = url
    this._protocols = protocols
    this._options = Object.assign({}, defaultOptions, options)
    this._messageQueue = []
    this._reconnectAttempts = 0
    this.readyState = this.CONNECTING

    if (options.automaticOpen) this.open()
  }

  open = (reconnectAttempt) => {
    let socket = this._socket = new WebSocket(this._url, this._protocols)
    socket.binaryType = this._options.binaryType

    if (reconnectAttempt) {
      if (this._options.maxReconnectAttempts && this._options.maxReconnectAttempts < this._reconnectAttempts) {
        return
      }
    } else {
      this._reconnectAttempts = 0
    }

    this._syncState()

    socket.onmessage = this._onmessage.bind(this)
    socket.onopen = this._onopen.bind(this)
    socket.onclose = this._onclose.bind(this)
    socket.onerror = this._onerror.bind(this)
  };

  send = (data) => {
    if (this._socket.readyState === WebSocket.OPEN && this._messageQueue.length === 0) {
      this._socket.send(data)
    } else {
      this._messageQueue.push(data)
    }
  };

  close = (code, reason) => {
    if (typeof code === 'undefined') code = 1000

    if (this._socket) this._socket.close(code, reason)
  };

  _onmessage = (message) => {
    this._syncState()
    this.onmessage && this.onmessage(message)
  };

  _onopen = (event) => {
    this._syncState()
    this._flushQueue()

    this.onopen && this.onopen(event)
  };

  _onclose = (event) => {
    this._syncState()
    if (this._options.debug) console.log('WebSocket: connection is broken', event)

    this.onclose && this.onclose(event)

    if (!event.wasClean) {
      setTimeout(() => {
        if (this.readyState === this.CLOSED) {
          this._reconnectAttempts++
          this.open(true)
        }
      }, this._getTimeout())
    }
  };

  _onerror = (event) => {
    this._syncState()
    if (this._options.debug) console.error('WebSocket: error', event)

    this.onerror && this.onerror(event)
  }

  _flushQueue = () => {
    while (this._messageQueue.length !== 0) {
      let data = this._messageQueue.shift()
      this._send(data)
    }
  };

  _getTimeout = () => {
    let timeout = this._options.reconnectInterval * Math.pow(this._options.reconnectDecay, this._reconnectAttempts)
    timeout = timeout > this._options.maxReconnectInterval ? this._options.maxReconnectInterval : timeout
    return getRandom(timeout / this._options.randomRatio, timeout)
  };

  _syncState = () => {
    this.readyState = this._socket.readyState
  };
}

function getRandom (min, max) {
  return Math.random() * (max - min) + min
}

export default ReconnectableWebSocket
