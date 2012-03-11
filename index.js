
// calc the LCS of two arrays.

function head (a) {
  return a[0]
}
function tail(a) {
  return a.slice(1)
}

exports.lcs = 
function lcs(a, b) {

var cache = {}

  function key (a,b){
    return a.length + ':' + b.length
  }

  function recurse (a, b) {

    if(!a.length || !b.length)
      return []
    //avoid exponential time by caching the results
    if(cache[key(a, b)])
      return cache[key(a, b)]

    if (a[0] == b[0])
      //return a[0] + LCS (tail(a), tail(b))
      return [head(a)].concat(recurse(tail(a), tail(b)))
    //then add a[0] to the LCS
    else {
      
      var _a = recurse(tail(a), b)
      var _b = recurse(a, tail(b))
      var _lcs
      if(_a.length > _b.length)
        _lcs = _a
      else
        _lcs = _b

      cache[key(a,b)] = _lcs
      return _lcs
    }
  }
  return recurse(a,b)
}

//generate a list of changes between a and b.
//changes are stored in the format of arguments to splice.
//index, numToDelete, ...itemsToInstert
exports.diff = 
function diff (a , b) {
  a = a.slice()
  b = b.slice()
  var lcs = exports.lcs(a,b)

  //how to print a diff.
  //iterate through lcs.
  //if first item in a is not present, it must have been deleted.
  //if first item in b is not present, it must have been added.
  var l = a.length
  var changes = []
  while(lcs.length || a.length || b.length) {
    var index = l - a.length 
    var del = 0
    var insert = []
    while((head(a) != head(lcs)) && a.length) {
      del ++
      a.shift()
    }
    while(head(b) != head(lcs) && b.length) {
      insert.push(b.shift())
    }
    //we must now be at a point that all three lists are equall.
   
    if(del || insert.length)  {
      insert.unshift(del)
      insert.unshift(index)
      //store changes in reverse order,
      //so that you can apply insertions and deletes to the end of the list
      //without affecting the indexes at the start of the list.
      changes.unshift(insert)
    }
    lcs.shift()
    a.shift()
    b.shift()
  }
  return changes
}

exports.patch = function (a, changes, mutate) {
  if(mutate !== true) a = a.slice(a)//copy a
  changes.forEach(function (change) {
    [].splice.apply(a, change)
  })
  return a
}

