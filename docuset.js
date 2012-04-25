
var u = require('./utils')
var es = require('event-stream')
var EventEmitter = require('events').EventEmitter

/*
  need to inject the difftools, and validate functions here.

  inject a createRepo that takes the name, and can setup different Repo types,
  with different validation, diffutils, and merge rules.
*/

var Repo = require('./')

var _createRepo = function () {
  return new Repo()
} 

//should probably require that the first message is
// ['AUTH', credentials]
function Docuset (opts) {
  if(!(this instanceof Docuset)) return new Docuset(opts)
  opts = opts || {}
  var createRepo = opts.createRepo || _createRepo
  var repos = this.repos = {}
  var self = this
  this.id = opts.id || '#' + Math.random()
  //could also make this create a stream instance
  this.createRepo = function (key) {
    if(repos[key])
      return repos[key]
    repos[key] = createRepo(key)
    this.emit('new', repos[key])
    return repos[key] 
  }
  this.createRawHandler = function (onConnect) {
    return function (ins, outs) {
      if(!outs)
        outs = ins
      if(!outs.writable)
        throw new Error('out stream must be writeable')
      if(!ins.readable)
        throw new Error('in stream must be writeable')
      //listen to repo for updates!
      var remotes = {}
      var listeners = {}
      var queue = []
      function flush () {
        while(queue.length)
          queue.shift()()
      }
      function createIf(key, id) {
        remotes[key] = remotes[key] || {}
        if(repos[key]) return
        //need injectable configuration per repo ...
        //like whether to accept non ff, and what diffutils to use.
        self.emit('new', repos[key] = createRepo(key))
      }

      function track(key) {
        createIf(key)
        var branches = repos[key].branches
        var r = repos[key]
        //remotes[key] = u.extend(remotes[key], branches)
        if(listeners[key]) return
   
        listeners[key] = function (revs, branch) { //change order so consistant
          //need to queue this, and set a nextTick to flush the queue.
          //am queuing updates, because want to return
          // from processing an update, before I think about 
          //sending anything back to another connection.
          queue.push(function () {
            var head = r.branch(branch)
            var revs = r.getRevs(branch, remotes[key][branch]) 
            if(revs.length) { 
              outs.write(['UPDATE', key, branch, revs ]) 
              remotes[key][branch] = revs[revs.length - 1].id
            }
          })
          process.nextTick(flush)
        }
        //for each branch in the repo, bring the listener up to date.
        // NICEN this, just exec this whenever an update flushes.
        u.map(repos[key].branches, function (commit, branch) {
          //this breaks when a second repo connects.
          if(!remotes[key] || commit != remotes[key][branch]) {
            var revs = repos[key].getRevs(branch, remotes[key][branch])
            if(revs.length) {
              outs.write(['UPDATE', key, branch, revs])
              remotes[key][branch] = revs[revs.length - 1].id
            }
          }
        }) 

        repos[key].on('update', listeners[key])
        //THEY ARE PROBABLY NOT UP TO DATE.
      }
      var reciever = {
        sub: function (key, branches) {
          track(key, branches)
          return repos[key]
        },
        unsub: function (key) {
          repos[key].removeListener('update', listeners[key])
        },
        //do not call update directly, make a commit to the repo!
        update: function (key, branch, revs) {
          createIf(key)
          //update is an implicit sub.
          var id = repos[key].recieve(revs, branch, true) //??
          //since repo emits the update syncronously,
          //it sends before it updates the id
          remotes[key][branch] = id
          if(!listeners[key]) connection.sub(key)
          if(queue.length) flush()
        }
      }
      var connection = {
        sub: function (key) {
          track(key)
          outs.write(['SUB', key, repos[key].branches])
          return repos[key]
        },
        unsub: function (key) {
          outs.write(['UNSUB', key])
        }
      }
      ins.pipe(es.map(function (data) {
        var type = data[0]
        ;(reciever)[type.toLowerCase()].apply(null, data.slice(1))
      }))
 
      if(onConnect) onConnect(connection)
      self.emit('connection', connection)
      return connection
    }
  }

  this.createHandler = function (onConnect) {
    var handler = self.createRawHandler(onConnect)
    return function (ins, outs) {
      outs = outs || ins
      var stringify = es.stringify()
      stringify.pipe(es.log()).pipe(outs)
      return handler(
        ins.pipe(es.split()).pipe(es.parse()),
        stringify
      )
    }
  }

  this.handler = this.createHandler() 
}

Docuset.prototype = new EventEmitter()

/*
  add this from somewhere else so that I can use this from the browser 
  with socket.io instead.

*/

Docuset.prototype.createServer = function (server, onConnect) {
  // TODO: support different server types, http, socket.io
  // maybe subclasses would be a good way to do this?
  if('function' === typeof server)
    onConnect = server, server = null
  var handler = this.createHandler(onConnect)
  if(server instanceof EventEmitter) {
    //assume that a server has been passed in
    this._server = server
    server.on('connection', handler)
  } else {
    // (require)() is a trick so that browserify will not bundle.
    var net = (require)('net')
    this._server = net.createServer(handler)
  }
    
  function proxy (e, _e, event) {
    e.on(event, function () {
      var args = [].slice.call(arguments)
      args.unshift(event)
      _e.emit.apply(_e, args)
    }) 
  }
  proxy(this, this._server, 'new')
  //proxy(this, this._server, 'connection')
  //RENAME THE CONNECTION EVENT. that name is special

 return this._server
}

Docuset.prototype.createConnection = 
Docuset.prototype.connect = function () {
  var args = [].slice.call(arguments)
  var soc = net.createConnection.apply(null, args)
  var con = this.createHandler()(soc)

  con._socket = soc
  return con
}

module.exports = Docuset

