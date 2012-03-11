#diff

perform diffs, and patches on arrays in javascript.

``` js

  var diff = require('diff')
  var a = ['T', 'A', 'N', 'Y', 'A', 'N', 'A']
    , b = ['B', 'A', 'N', 'A', 'N', 'A']
  var d = diff.diff(a, b)
  console.log(d)

  //  [               //same format as Array.splice 
  //    [ 3, 1 ]      //delete 1 element at index 3
  //  , [ 0, 1, 'B' ] //delete 1 element at index 0, then insert 'B'
  //  ]

  var aPatched = diff.patch(a, changes)

  var assert = require('assert')
  assert.deepEqual(aPatched, b)

```

## next...

now, just need a three way merge...

```

merge(a, b, concestor)
diff concestor a
diff concestor b
merge the changes
apply to concestor.

```

hmm, how do you merge changes? 
if they are from sequential commits.
could apply one, then the next,
then recalculate the changes?
you might need to do that.

if a'' changes a change in a', say, deleted something that was inserted.
just do the simple way, recalculate the change. smarter way later.

what about if the merges are from parallel commits?
(assuming each branch has been flattened to a single patch)

apply the changes, but check if changes overlap... in that case make an error.
what if two commits make the same changes? what does git do?
git detects that two commits are the same.
prehaps, a simple test for the same change is enough.

TODO: some reading on three-way-merge
