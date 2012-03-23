
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

/*
  if two commits are made simultaniously,
  merges go crazy.

  that is not meant to happen.

  it's like, both commits are on the wire at the same time,
  then they both get merged seperately on each end,
  and then do get sent back, but then they arn't ff and more,
  so they need another merge.

  A Race condition.

  another possibility, is that the merges are actually identical.
  yet, thier time stamps are different.

  need a way to detect identical merges, and just go with that instead.
  also... if we're doing automatic merges, need them to come out the same.
  probably, don't merge two merges.

  another approach, might be after sending commit
  allow other to respond with a new head or a merge.
  before sending them something else?

  i think the better course might be is detect the case where both sides merge, and have a way of just picking the winning merge.

  of course, this is avoided by forcing only one side to do the merge.
  or to merge consistantly.

  i'll call this the parallel merge problem.

  what if I just left out the timestamp in the hash of a merge?
  then it would be possible to create an identical merge on both sides?

  more testing will be necessary. 
*/

//setTimeout(function () {
setInterval(function () {
  a.data.list.unshift('whatever')
  console.log('A', JSON.stringify(a.data.list))
  a.commit(a.data)
//  a.data.list.unshift('whatever')
//  console.log('A', JSON.stringify(a.data.list))
//  a.commit(a.data)


}, 1000) 
//}, 500)
