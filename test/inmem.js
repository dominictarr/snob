
var d = require('../inmem')
var assert = require('assert')
var server = d().createServer().listen()
var client = d().connect(server)

function logger (name) {
  return function (m,n) {
    console.log(name+":", m,n)
  }
}

var r = client.sub('hello')
//would be nice to just default to {parent: 'master'}
//oh, will probably be adding author too...
//r.on('update', logger('1'))

var a2 = r.commit({a: true})
var a2 = r.commit({a: 2})

function wait (repo, commitish, fn) {
  function handler (revs) {
    var last = revs[revs.length - 1].id
    console.log('at', last)
    if(last !== commitish) return

    repo.removeListener('update', handler)    
    fn(revs)
  }
  repo.on('update', handler) 
}

server.once('new', function (r0) {
  console.log('new', r0)
  wait(r0, a2.id, function () {
    assert.deepEqual(r0.checkout(), {a: 2})
    console.log('here')
      // a second connection to the hello document!
    var client2 = d().connect(server)
    var r2 = client2.sub('hello')
    var n = 1
    
    /*r.once('update', function () {
      assert.deepEqual(r.checkout(), {a: 2})
      next()
    })*/
    r2.once('update', function () {
      assert.deepEqual(r2.checkout(), {a: 2})
      r2.commit({a: 2, b: 3})

      r.once('update', function () {
        assert.deepEqual(r.checkout(), {a: 2, b: 3})
        console.log('PASSED')
      }) 
    }) 
  })
})
