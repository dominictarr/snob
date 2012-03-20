
var assert = require('assert')
var Repo = require('../')
var snob = new Repo()
var world
var init = snob.commit(world = {
    hello: ['who', 'what', 'when','why']
  },
  { message: 'init'})

assert.equal(init.depth, 1)
console.log(init)

var _world = snob.checkout(init.id)

assert.deepEqual(_world, world)

console.log(_world, world)
world.hello.splice(2, 0, 'how')
var second = snob.commit(world, {
    message: 'second',
    parent: init.id
  })

console.log(second)
console.log(snob.revlist(second.id))

assert.deepEqual(
  snob.revlist(second.id), 
  [ init.id, second.id])

//a branch off init, so can test merge

_world.hello.push('WTF!?')
var branch = snob.commit(_world, {
    message: 'branch',
    parent: init.id
  })

assert.equal(branch.depth, 2)

assert.deepEqual(snob.revlist(branch.id), [init.id, branch.id])

var concestor = snob.concestor(branch.id, second.id)

assert.equal(concestor, init.id)

var merged = snob.merge([branch.id, second.id], {message: 'merged'})

assert.ok(!snob.isFastForward(branch.id, snob.revlist(second.id)))

console.log(merged)
assert.equal(3, merged.depth)
var rl = snob.revlist(merged.id)
var readable = rl.map(function (id) {
  return snob.get(id).message
})

assert.deepEqual(readable, ['init', 'branch', 'second', 'merged'])

assert.deepEqual(rl, [init.id, branch.id, second.id, merged.id])

assert.ok(snob.isFastForward(branch.id, rl))
assert.deepEqual(snob.isFastForward(branch.id, rl), [second.id, merged.id])
var world3 = snob.checkout(merged.id)

console.log(world3)


