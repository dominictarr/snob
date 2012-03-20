// test replication without IO, just in memory.

var assert = require('assert')
var Repo = require('../')
var Replicator = require('../replicator')({
  preadd: function (commits, pulled, callback) {
    console.log('PRE', commits, pulled)
    // pulled is true if you pulled these.
    // if they where pushed to you, false.
    // check whether the commits are fast-forward, for example.
    // if calls back an error, that vetos the commits.

    // `this` should be the replicator.
    callback(null)
  },
  postadd: function (commits, pulled, callback) {
    //maybe auto merge the commits, for example.
    //should callback commits that the pusher should add.  
    console.log('POST', commits, pulled)
    callback(null)
  }
})
var snob = new Repo()
var snob2 = new Repo()
var world
var init = snob.commit(world = {
    hello: ['who', 'what', 'when','why']
  },
  { message: 'init'})


//what happens if you ask for decendants, but have different heads?

assert.deepEqual(snob.decendants([]), [init])

world.hello.splice(2, 0, 'how')
var second = snob.commit(world, {
    message: 'second',
    parent: init.id
  })

// -- the basic functionality that replication will depend on.

assert.deepEqual(snob.decendants([]), [init, second])
assert.deepEqual(snob.decendants([init.id]), [second])

snob2.add([init, second])
assert.deepEqual(snob2.checkout(second.id), world)

var snob3 = new Repo()

var r1 = new Replicator(snob)
var r2 = new Replicator(snob3)

r1.push(r2, function () {
  //r2 should have accepted the commits from R1
  assert.deepEqual(snob3.commits, snob.commits)
})

// well, that is just simple.
var snob4 = new Repo()
var r3 = new Replicator(snob4)

r3.pull(r1, function () { 
  assert.deepEqual(snob4.commits, snob.commits)
})


var s1 = new Repo()
var a = s1.commit({hi: ['a']},     {parent: null})
var b = s1.commit({hi: ['a','b']}, {parent: a.id})
var s2 = new Repo ()
s2.add([a])
var c = s2.commit({hi: ['a', 'c']}, {parent: a.id})

console.log(s1.decendants([c.id]))
//OH, IAVE MADE A FEW MISTAKES RETHINK.
//YOU CANT JUST SEND YOUR HEADS, UNLESS THE OTHER REPO IS A HEAD.
//if you may be ahead, you need something different.
/*
  you need to know where the your two trees start to differ.

  if other is

          d
         /
  a--b--c

  and this is

  a--b--c
         \
          e

  then i need to know that c is the last item they had in common.
  also, prehaps i should refactor so that commits are stored in branches? LIKE GIT.

 if this was pushing to other, it would send it's revlist,
 and ask when remote matched that, it would answer "c"
 (or better, it would remember from last time)

the mistake i made was sending heads, that only works when you are behind. if you are ahead. must send revlist. it makes much more sense to just send a branch in that case, rather than the leaves.

REWRITE THE NEW STUFF.
   
*/

/*

A replicate B --> 
copy all changes from B, and send all changes to B
if A and B get dirvergent changes, then copy 

something like

snob1.replicate(snob2)

remembering that it must replicate through an async
proxy... that may be reimplemented with network io in the middle!
*/


