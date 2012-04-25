
var Docuset = require('./docuset')
var es = require('event-stream')
//this implements a server interface, but entirely in memory.

module.exports = function (opts) {

  var d = new Docuset(opts)
  d.createServer = function (onConnect) {
    this.listening = false
    this.listen = function () {
        var cb = arguments[arguments.length - 1]
        this.listening = true
        if('function' == typeof cb)
          process.nextTick(cb)
        return this
      }
    
    this._isInMemoryServer = true
    this._connect = function () {
      var ins = es.asyncThrough()
      var out = es.asyncThrough()
      this.createHandler(onConnect)(ins, out)
      return es.duplex(ins, out)
    }
    return this
  }
  d.connect = d.createConnection =
    function (other, cb) {
      if(!other._isInMemoryServer)
        throw new Error('other must be an inMemory Server')
      if(!other.listening)
        throw new Error('other is not listening')
      return this.createHandler()(other._connect())
    }

  return d
}
