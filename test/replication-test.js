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

/*

say there are two repos X, Y

          d
X:       /
  a--b--c

Y:
  a--b--c
         \
          e--f

if Y wanted to push to X it should fail because it would need to merge e--f with d.
even if this was allowed, Y should know that X already has a--b--c, and should only send e--f

if Y pulls, it should send the revlist for f (f,e,c,b,a) so that X knows to send d only.
Y.pull(X.since(Y.revlist('master'), 'master'), 'master')

situations
  fast-forward .... when the remote head is an ancestor of the local head.
  merge ........... when the remote head is an uncle, cousin, nephew etc.

push and pull are identical underneath. it's just they have different rules about how to handle the
merge case. (push rejects merge)

so, if Y pulls d, and merges we get


Y:
  a--b--c      d
         \    /
          e--f

then, gotta send that to Y, but that isn't a fast-forward...
no, it is. git allows me to push this. since it merges with d,
it just accepts the new changes... 
I'm not sure exactly how it decideds what a fast-forward is.
how close a representation is the revlist?

it would have to merge like

          d
Y:       / \
  a--b--c   e--f

that would be rebasing!
in rebasing, commits get new ids, and can still have merge conflicts.

how does git actually behave in this case?

IDEA
  stop thinking of commits as linear.
          d--.
         /    \
  a--b--c      merge
         \    /
          e--f

  this is a fast forward because it's head is an decendant of d, which was the head of Y.
  to get this to Y, I only have to send e, f, and merge.

  RIGGGHT ! 
  git rev-list --parents master

  with a merge! this is actually how git works!

  so, this means that the revlist is actually a flattening of the tree.
  though, that makes checking for a fast-forward easy.
  
  double check this, by repeating the above experiment, without a conflicting merge.
  yes!

  the way that git shows log it appears that commits get inserted between each other. not the case.

  so, to check a push is a fast-forward, 
  just have to know whether the remote head is a ancestor of the local head.

  --------------------

  which commits need to be sent?

  if you know the remote head, send all ancestors that are not also ancestors of the remote head.
  
  if you pull, but have your own changes, which changes does the remote send?
  (if you gave your rev-list, all changes that you don't have)
  or, you could remember where you diverge

  whenever you recieve commits from another repo, remember which repo the head came from?
  (thats enough to know the ancestors)

  yes, git does that.  git show origin/master
*/
