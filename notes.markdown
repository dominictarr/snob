# syncronising remote repos.

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

it needs to indicate that it already knows about a,b,c. either it needs to send the revlist, (f,e,c,b,a) or X needs to remember that it is Y is synced up to c (because the they exchanges a,b,c preiously)

situations
  fast-forward .... when the remote head is an ancestor of the local head.
  merge ........... when the remote head is an uncle, cousin, nephew etc.

(merge and ff are mutually exclusive)

push and pull are identical underneath. it's just they have different rules about how to handle the merge case. pull merges if the changes, push rejects the changes.

so, if Y pulls d, and merges we get


Y:
  a--b--c      d
         \    /
          e--f

at first glance, this doesn't look like a fast-forward,
but git would allow you to push this. whats really happening?

stop thinking of commits as linear.

          d--.
         /    \
  a--b--c      merge
         \    /
          e--f

  this is a fast forward because it's head is an decendant of d, which was the head of Y.
  to get this to Y, I only have to send e, f, and merge.

  `git log` makes the commits (even with a merge) appear linear.
  but `git rev-list --parents master`  will show merges having two parents.

  the revlist is actually a flattening of the tree.
  though, that makes checking for a fast-forward easy.
  
  the way that git shows log it appears that a merge can insert commits between each other.

# sending minimal changes

  which commits need to be sent?

  if you know the remote head, send all ancestors that are not also ancestors of the remote head. 
  if you pull, but have your own changes, which changes does the remote send?
  (if you gave your rev-list, all changes that you don't have)
  or, the remote could remember where you where last in sync. or, you could remember, and send that with the request.

  whenever you recieve commits from another repo, remember which repo the head came from?
  (thats enough to know the ancestors)

it seems git does this to some degree, in so much as it names remotes, i think.
the remote may not remember who you are, but a dev checkout out will.

## simultanious sync race condition -- parallel merge problem.

yesterday, I found a situation where two remote repos made a changes and tried to sync to each other simultaniously, which caused a cascade of merge commits.

if two commits passed each on the wire, both repos recieve non-ff revs. both try to merge, createing merge commits with different timestamps, and therefore different hashes.

after creating a new merge commit, the repo tries to sync it to the other repo, but since that repo has also merged -- it is not a ff.

how to work around this?

the merges should be identical, they have the same parents, yet thier hashes are different because thier timestamps are different, and the order that thier parents are listed may be different.

one approach is to make sure that merges with the same parents get the same id.

another way, would be to detect identical merges, and have each repo pick the same one to be head.

another approach, might be after sending commit
allow other to respond with a new head or a merge.
before sending them something else?

normally, git avoids this problem by forcing just one side to be responsible for the merge.

I'll call this the parallel merge problem.

After a night's sleep, designing merges to be deterministic neems like the best approach. that will let both two repo's independantly perform the same merge, instead of waiting for the otherside to send the merge.


