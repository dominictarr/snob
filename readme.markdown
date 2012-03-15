# snob

snob is a version control system written in js. consider it a a minimial port of git.
one of the best uses is to learn you exactly how git works. 

## how git works.

if you want to know what is the difference between two files, you must first know what is the same.
this is called the Longest Common Subsequence problem. if you have two sequences `x = "ABDCEF" and `y = "ABCXYZF"` then `LCS(x,y)` is clearly "ABCF".


## lcs

```
function lcs (a,b)
  if head(a) == head(b)
    then lcs(a,b) = head(a) + lcs(tail(a), tail(b))
  else lcs(a, b) = max(lcs(tail(a),b), lcs(a, tail(b)))
```

(where max returns the longer list, head return the first element, and tail returns the rest of the sequence minus the head)

this is very simple, but with exponential time complexity.
however, it can easily be made sufficantly performant by cacheing the return value of each call to lcs().

see js implementation, (./index.js#L64-94)

## chunking

now, we can see when the strings differ, by comparing them to the lcs. the next step is dividing them into 'stable' chunks where they match the lcs, and unstable chunks where they differ.

basically, to go from `chunk("ABDCEF", "ABCXYZF")` to 
`["AB", ["D", ""], "C", ["E", "XYZ"], "F"]`

note that stable and unstable chunks always alternate.

basically, you iterate over the sequences and while the heads match the head of the lcs, shift that value to a stable chunk.
then, while the heads do not match the next head of the lcs,
collect add those items into an unstable chunk.

## diff

once you have the chunks getting a list of changes that you can apply is easy...

making a diff from a to b we want to know what changes to make to a to get b. 
the way I have node this (https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/splice)[Array#splice]
so, for `["AB", ["D", ""], "C", ["E", "XYZ"], "F"]`we want:

``` js
  var changes = [
    [4, 1, 'X', 'Y', 'Z'], //delete 1 item ("E") at index 4, then insert "X", "Y", "Z"
    [2, 1] //delete 1 item at index 2 ("D")
  ]
``` 

note, you can apply changes to the end of the array without altering the indexes in the start of the array.

this makes the function to apply the patch _very_ simple

## patch

``` js
  function patch (orig, changes) {
    var ary = orig.split('') //assuming that orig is just a string
    changes.forEach(function (e) {
      [].splice.apply(ary, changes)
    })
    return ary.join('')
  }
```

## diff3
 
if we want a _distributed_ version management system, the we need to be able to make changes in parallel.
this is only a slightly more complicated problem. given a string `"ABDCEF"`, If I changed it to `"ABCXYZF"`
and meanwhile you changed it to "AXBCEFG". we must compare each of our changes to the original string, the (http://en.wikipedia.org/wiki/Concestor)[Concestor] 

TODO: worked example with chunks, resolve.
