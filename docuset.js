
var u = require('./utils')
var es = require('event-stream')
var EventEmitter = require('events').EventEmitter
var Repo = require('./')
var render = require('render')

function Docuset () {
  var repos = this.repos = {}
  var self = this
  //could also make this create a stream instance
  this.createRawHandler = function (onConnect) {
    return function (ins, outs) {
      if(!outs)
        outs = ins

      //listen to repo for updates!
      var remotes = {}
      var listeners = {}

      function createIf(key) {
        if(repos[key]) return
        remotes[key] = remotes[key] || {}
        //need injectable configuration per repo ...
        //like whether to accept non ff, and what diffutils to use.
        self.emit('new', repos[key] = new Repo())
      }
      function track(key) {
          createIf(key)
          var branches = repos[key].branches
          //remotes[key] = u.extend(remotes[key], branches)
          if(listeners[key]) return
     
          listeners[key] = function (revs, branch) { //change order so consistant
            var head = repos[key].branch(branch)
            var revs = repos[key].getRevs(branch, remotes[key][branch]) 
            if(revs.length) 
            outs.write(['UPDATE', key, branch, revs ])
          }
          //for each branch in the repo, bring the listener up to date.
          u.map(repos[key].branches, function (commit, branch) {
            if(commit != remotes[key][branch]) {
              var revs = repos[key].getRevs(branch, remotes[key][branch])
              if(revs.length) {
                outs.write(['UPDATE', key, branch, revs])
                remotes[key][branch] = revs[revs.length - 1].id
              }
            }
          }) 

          repos[key].on('update', listeners[key])
 
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
    }

  }

  this.createHandler = function (onConnect) {
    var handler = self.createRawHandler(onConnect)
    return function (ins, outs) {
      outs = outs || ins
      var stringify = es.stringify()
      stringify.pipe(es.log()).pipe(outs)
      handler(
        ins.pipe(es.split()).pipe(es.parse()),
        stringify
      )
    }
  }

  this.handler = this.createHandler() 
}

Docuset.prototype = new EventEmitter()

module.exports = Docuset