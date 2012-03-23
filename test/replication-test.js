// test replication without IO, just in memory.

var assert = require('assert')
var Repo = require('../')
var snob = new Repo()
var snob2 = new Repo()
var world

var init = snob.commit(world = {
    hello: ['who', 'what', 'when','why']
  },
  { message: 'init'})

world.hello.splice(2, 0, 'how')

var second = snob.commit(world, {
    message: 'second',
    parent: init.id
  })

snob2.addCommits([init, second])
assert.deepEqual(snob2.checkout(second.id), world)


