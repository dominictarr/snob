
var Repo = require('./')
var net = require('net')
var es = require('event-stream')
var s = new Repo()
var c = new Repo()
var _s

function streamSync(name, update) {
  var repo = new Repo()

  var synced = {
    commit: function (update) {
      var commit = repo.commit(update, {parent: 'master', author: name})
      synced.send()
      synced.data = update
      if(synced.onupdate) synced.onupdate(update, 'this')
    },
    data: null,
    repo: repo,
    handler: function (ins, out) {
      //refactor this to handle multiple connections per repo.
      //that will require a new connection to id itself?
      //incase of reconnections?
      //it could connect, and send it's revlist.
      //prehaps it's time to create a protocol.
      /*
        connect [revlist]
        commit [commits]
        error  [list of unknown commits|forbidden non-FF]
        pull [branch, since] //since is optional.

        ALSO, support syncing multiple repos over a single connection.

        WATCH repoId, myHead, REQID //put req id last, like a callback
        UNWATCH repoId, REQID
        UPDATE repoId, branch
          [commits], REQID
        ERROR [message]
        //PULL repoID, branch, myHead

        INIT connection ... identify your connection, so that if you are disconnected, do not have to resend heads?
        or, just nah, not necessary, since WATCH has myHead as a parameter.
 
        ... other messages should be IGNORED, so that it's possible to send other stuff... like queries of the set of repos... (necessary to hold multiple repos, when you have stuff that varies independantly)

        WATCH means you want changes for a named repo.
        UNWATCH means to stop getting changes.
        //okay, so this could be SUB, UNSUB
        UPDATE repoId, branch, commits
        //could also be PUB
        ERROR ... a request was wrong, somehow.

        hmm, should every message have an ID, so can assign responses
        like, show that an error corrisponds to a particular request?

        possible errors:
          dangling commit.
          don't have that Repo. (404)
          nonFF denied.
          
      */
      synced.ins = ins
      synced.out = out || ins 
      synced.out.pipe(es.split()).pipe(es.map(function (data) {
        data = JSON.parse(data)
        try {
          var id = repo.recieve(data, 'master', true)
          repo.remote('other', 'master', id)
        } catch (err) {
          throw (err)
        }
        var data = synced.data = repo.checkout('master')
        var l = data.list.length
        var resolved = false
        while(l--) {
          //resolve conflicts
          if('object' == typeof data.list[l]) {
            var conflict = data.list[l]['?'][0]
            ;[].splice.apply(data.list, [l, 1].concat(conflict)) 
            resolved = true
          }
        }
        if(resolved) {
          synced.commit(data)
        }
        if(synced.onupdate) synced.onupdate(synced.data, 'other')
        synced.send() // incase it was a merge
      }))
      synced.send()
    },
    send: function () {
      if(repo.remote('other', 'master') == repo.branch('master'))
        return
      //don't sync if not connected.
      if(synced.out) {
        var data = repo.send('other', 'master')
        synced.out.write(JSON.stringify(data) + '\n')
        repo.remote('other', 'master', repo.branch('master'))
      }
    },
    onupdate: update
  }
  return synced
}

var data = {
  list: []
}
var a = streamSync('A', checkSynced)
var b = streamSync('B', checkSynced)
var c = streamSync('C', console.log)

var server = net.createServer(a.handler)
server.listen(8282, function () {
  var client = net.createConnection(8282, function () {
    b.handler(client)
 }) 
/*  var client2 = net.createConnection(8282, function () {
    c.handler(client2)
  })*/
})

function checkSynced(_, source) {
  console.log( 
    a.repo.branch('master') == b.repo.branch('master')
    ? 'SYNCED'
    : 'UN-SYNCED', source
  ) 
   
}

setInterval(function () {
  //return
  b.data.list.push(b.data.list.length)
  b.commit(b.data)
}, 1e3)

a.commit({list: ['crazy']})

//setTimeout(function () {

setInterval(function () {
  a.data.list.push('?')
  a.commit(a.data)
}, 1200)

//}, 500)
