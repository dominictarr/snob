
var assert = require('assert')
var Repo = require('../')
var snob = new Repo()
var world
var init = snob.commit(world = {
    hello: ['who', 'what', 'when','why']
  },
  { message: 'init', parent: 'master'})

assert.equal(init.depth, 1)
console.log(init)

var _world = snob.checkout(init.id)

assert.deepEqual(_world, world)

console.log(_world, world)
world.hello.splice(2, 0, 'how')
var second = snob.commit(world, {
    message: 'second',
    parent: 'master'
  })

console.log(second)
console.log(snob.revlist(second.id))

assert.deepEqual(
  snob.revlist(second.id), 
  [ init.id, second.id])

var snob2 = new Repo()
var snob3 = new Repo()
//we're not using branches in this test.
//however, we can use a commit like a branch.
//since a branch is just a pointer to a commit.
snob2.clone(snob, 'master') // this should just pull all the commits.
snob3.clone(snob, 'master')

assert.deepEqual(snob2.commits, snob.commits)
assert.deepEqual(snob3.commits, snob.commits)

//can only clone an empty repo.
assert.throws(function () {
  snob2.clone(snob, 'master')
})

_world.hello.push('WTF!?')

snob.branch('branchy', init.id)
var branch = snob.commit(_world, {
    message: 'branch',
    parent: 'branchy'
  })

assert.equal(branch.depth, 2)

assert.deepEqual(snob.revlist('branchy'), [init.id, branch.id])

//if snob tries to push to snob2 we'll get a non-ff error.

var concestor = snob.concestor(branch.id, second.id)

assert.equal(concestor, init.id)

var merged = snob.merge(['master', 'branchy'], {message: 'merged'})

assert.ok(!snob.isFastForward(branch.id, snob.revlist(second.id)))

// here I'm passing in the commit that is expected to be the remote 
// head. normally you would just say push(remote, branch) 
// where branch is a name ("master") that refurs to different commits
// on each end. down the road, snob will cache this, to avoid a 
// network-round-trip.
snob.push(snob2, 'master')
snob3.pull(snob, 'master')
assert.deepEqual(snob3.revlist('master'), snob.revlist('master'))

console.log(merged)
assert.equal(3, merged.depth)
var rl = snob.revlist(merged.id)

function messages(revlist) {
  return rl.map(function (id) {
    return snob.get(id).message
  })
}

var readable = messages(rl)

assert.deepEqual(readable, ['init', 'second', 'branch', 'merged'])

assert.deepEqual(rl, [init.id, second.id, branch.id, merged.id])
var ff = snob.isFastForward(second.id, rl)

console.log(messages(ff))
assert.ok(ff)

assert.deepEqual(ff, [branch.id, merged.id])

var world3 = snob.checkout('master')
console.log(world3)


