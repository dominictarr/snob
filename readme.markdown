#diff

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

refactors:

  exports a function that returns the adiff

  allow different equals, and resolve rules.

  change arg order to concestor, mine, yours 

  should I generate a new sequence from the merge?
  or generate a patch?
  or just make the new sequence and then make the patch?
 
todo: maybe change how resolve works so that blame, or line age
will be possible.

#next

commit tree!



