#adiff

perform diffs, and patches on arrays in javascript.

``` js

  var adiff = require('adiff')
  var a = ['T', 'A', 'N', 'Y', 'A', 'N', 'A']
    , b = ['B', 'A', 'N', 'A', 'N', 'A']
  var d = adiff.diff(a, b)
  console.log(d)

  //  [               //same format as Array.splice 
  //    [ 3, 1 ]      //delete 1 element at index 3
  //  , [ 0, 1, 'B' ] //delete 1 element at index 0, then insert 'B'
  //  ]

  var aPatched = adiff.patch(a, changes)

  var assert = require('assert')
  assert.deepEqual(aPatched, b)

```

## merge

okay, I think this works. just need to refactor a bit,
and double check test cases. 

#next

commit tree!

add a list to track,
commit (new state)
create a list of commits,

  - a log for each branch

what does a commit look like?

``` js

  { changes: {'object': changes}
  , id: hashOfThisCommit
  , parent: hashOfParentCommit
  , depth: parent.depth + 1
  , author: authorid/name
  , message: editMessage
  , timestamp: time,
  , merge: [] //array of commit id's of parents, 
              //if this is a merge commit
  }

```

what will a repository look like, in memory?

{ branches: {
    master: commitIdOfMastersHead
  },
  commits: [] // array of commits 
}
`depth` will help with finding the concestor.
    

