
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
assert.ok(snob.id)

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

assert.ok(snob2.id)
assert.ok(snob3.id)

// clone always sends all commits for a branch.

snob2.clone(snob, 'master') // this should just pull all the commits.
snob3.clone(snob, 'master')

function assertSynced (local, remote) {

  assert.equal(
    local.remote(remote.id, 'master'), 
    remote.branch('master')
  )

  assert.equal(
    remote.remote(local.id, 'master'), 
    local.branch('master')
  )

}

assertSynced(snob, snob2)
assertSynced(snob, snob3)

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
var snob4 = new Repo()
snob4.clone(snob3, 'master')
assertSynced(snob4, snob3)

// what commits will snob push -> snob2
// branch, merged. 
var revs, rHead
assert.deepEqual(revs = snob.getRevs('master', rHead = snob.remote(snob2.id, 'master')), [branch, merged])

assert.ok(snob.isFastForward(rHead, revs))

snob.push(snob2, 'master')
assertSynced(snob, snob2)

var revs, rHead
assert.deepEqual(revs = snob.getRevs('master', rHead = snob.remote(snob3.id, 'master')), [branch, merged])

assert.ok(snob3.isFastForward('master', revs))

snob3.pull(snob, 'master')
assertSynced(snob, snob3)

//! now in a non ff pull, the local will merge the incoming revs, so the repo's will be out of sync

world.whatever = ['everything', 'changes']

console.log(snob4.commit(world, {message: 'whatever', parent: 'master'}))

console.log(snob.checkout('master'))
console.log(snob4.checkout('master'))
snob4.pull(snob, 'master')
console.log(snob4.getRevs('master'))
/*
  since snob4's pull is was not a ff,
  it the repo's should not be synced.
  the remote will think 4 has the commit it sent,
  but 4 will be correct about snob 0
*/

assert.equal(
  snob4.remote(snob.id, 'master'), 
  snob.branch('master')
)
//4 merged what 
assert.notEqual(
  snob.remote(snob4.id, 'master'), 
  snob4.branch('master')
)
assert.equal(
  snob.remote(snob4.id, 'master'), 
  snob.branch('master')
)

function messages(revs) {
  return revs.map(function (item) {
    return item.message
  })
}

console.log(messages(snob3.getRevs('master')))
console.log(messages(snob.getRevs('master')))

assert.deepEqual(snob3.revlist('master'), snob.revlist('master'))

console.log(merged)
assert.equal(3, merged.depth)
var rl = snob.getRevs(merged.id)

var readable = messages(rl)

assert.deepEqual(readable, ['init', 'second', 'branch', 'merged'])

assert.deepEqual(rl, [init, second, branch, merged])
var ff = snob.isFastForward(second.id, rl)

assert.ok(ff)
var ffrevs = snob.revlist(merged.id, second.id)

assert.deepEqual(ffrevs, [branch.id, merged.id])

var world3 = snob.checkout('master')
console.log(world3)


