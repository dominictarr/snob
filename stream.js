/*
  client sends greet.
  server responds with updates since greet,
  or sends thier own greet if they are the one behind.
  
  greet zero: clone
  greet one: head
  greet two: revlist.
  
  if you recieve clone. send all revs.
  if you recieve a head, but don't have that. send revlist.
  if you reiceve a revlist, send your updates since the concestor.

  if there was an error, send the error, then end the stream.

  idea: send sparse revlist, to maximise chance that you'll hit
  bit minimise amount to send.

  after the client has greeted, send any updates since the concestor

  the patterns here is getting consistent with my other duplex streams.
  through isn't right, because it has different pause behaviour.
*/

var through = require('event-stream').through
module.exports = function(repo, doGreet) {
  var queue = []
  var branch = 'master'
  var stream
  var greeted = false

  function enqueue(revs) {
    revs.forEach(function (e) {
      queue.push(['update', e, branch])
    })
    stream.drain()
  }
  var remote = []
  function ids (revs) {
    return revs.map(function (e) {
      return e.id
    })
  }
  function remember (revs) {
    revs.forEach(function (e) {
      if(!~remote.indexOf(e.id))
        remote.unshift(e.id)
    })
    console.log('REMOTE', remote)
  }
  function onUpdate () {
    if(!greeted) return
    if(stream.paused) return
    var sendRevs = repo.getRevs(branch, remote)
    if(!sendRevs.length) return
    remember(sendRevs)
    enqueue([sendRevs])
  }
  repo.on('update', onUpdate)
  stream = through(function (data) {
    var action  = data.shift()
    var payload = data.shift()
    var branch  = data.shift() || 'master'
    if(action == 'greet') {
      enqueue(repo.getRevs(branch, payload))
      //now, can start sending updates
      //repo.on('update',
      greeted = true
    } else if (action == 'update') {
      remember(payload)
      repo.recieve(payload, branch, true)
    } 
  }, function () {
    if(!this.paused && !queue.length)
      this.emit('end')
  })
  //called from the client.
  stream.greet = function () {
    if(greeted) return
    greeted = true
    queue.unshift(['greet', repo.revlist(branch), branch])
    stream.drain()
    return stream
  }
  var write = stream.write
  stream.write = function (data) {
    write.call(stream, data)
    return true
  }
  stream.drain = function (resumed) {
    while(!stream.paused && queue.length)
      stream.emit('data', queue.shift())
    if(!queue.length) {
      if(resumed)    stream.emit('drain')
      if(stream.ended) stream.emit('end')
    }
    return stream
  }

  stream.resume = function () {
    stream.paused = false
    onUpdate()
    if(!queue.length) return
    return stream.drain(true)
  }
  stream.queue = queue

  if(doGreet !== false)
    process.nextTick(stream.greet)

  return stream
}

