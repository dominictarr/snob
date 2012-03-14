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
 

