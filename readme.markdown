# snob

snob is a version control system written in js. consider it a a minimial port of git.
one of the best uses is to learn you exactly how git works. 

## how git works.

if you want to know what is the difference between two files, you must first know what is the same.
this is called the Longest Common Subsequence problem. if you have two sequences `x = "ABDCEF" and `y = "ABCXYZF"` then `LCS(x,y)` is clearly "ABCF".


### lcs

```
function lcs (a,b)
  if head(a) == head(b)
    then lcs(a,b) = head(a) + lcs(tail(a), tail(b))
  else lcs(a, b) = max(lcs(tail(a),b), lcs(a, tail(b)))
```

(where max returns the longer list, head return the first element, and tail returns the rest of the sequence minus the head)

this is very simple, but with exponential time complexity.
however, it can easily be made sufficantly performant by cacheing the return value of each call to lcs().

see js implementation, [./index.js#L64-94]

## chunking

now, we can see when the strings differ, by comparing them to the lcs. the next step is dividing them into 'stable' chunks where they match the lcs, and unstable chunks where they differ.

basically, to go from `chunk("ABDCEF", "ABCXYZF")` to 
["AB", ["D", ""], "C", ["E", "XYZ"], "F"]

note that stable and unstable chunks always alternate.

basically, you iterate over the sequences and while the heads match the head of the lcs, shift that value to a stable chunk.
then, while the heads do not match the next head of the lcs,
collect add those items into an unstable chunk.

## diff

once you have the chunks getting a list of changes that you can apply is easy...

## diff3
 


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
    

