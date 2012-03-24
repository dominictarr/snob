
var Repo = require('./')
var net = require('net')
var es = require('event-stream')
var s = new Repo()
var c = new Repo()
var _s

function streamSync(update) {
  var repo = new Repo()

  var synced = {
    commit: function (update) {
      var commit = repo.commit(update, {parent: 'master'})
      synced.send()
      synced.data = update
      if(synced.onupdate) synced.onupdate(update, 'this')
    },
    data: null,
    handler: function (ins, out) {
      synced.ins = ins
      synced.out = out || ins 
      synced.out.pipe(es.split()).pipe(es.map(function (data) {
        data = JSON.parse(data)
        console.log(data)
        try {
          var id = repo.recieve(data, 'master', true)
          repo.remote('other', 'master', id)
        } catch (err) {
          console.log(data[0].changes.list)
          process.exit(1)
        }
        var data = synced.data = repo.checkout('master')
        var l = data.list.length
        var resolved = false
        while(l--) {
          //resolve conflicts
          if('object' == typeof data.list[l]) {
            var conflict = data.list[l]['?'][0]
            console.log(data.list[l])
            ;[].splice.apply(data.list, [l, 1].concat(conflict)) 
            resolved = true
          }
        }
        if(resolved) {
          synced.commit(data)
          console.log(data)
 //         process.exit(1)
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
var a = streamSync()
var b = streamSync()
var server = net.createServer(a.handler)
server.listen(8282, function () {
  var client = net.createConnection(8282, function () {
    b.handler(client)
 }) 
})

setInterval(function () {
  b.data.list.push(b.data.list.length)
  console.log('B', JSON.stringify(b.data.list))
  b.commit(b.data)
}, 1e3)

a.commit({list: ['crazy']})

setInterval(function () {
  a.data.list.push('?')
  a.commit(a.data)
}, 1e3)
