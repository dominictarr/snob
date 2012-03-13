function head (a) {
  return a[0]
}

function last (a) {
  return a[a.length - 1]
}

function tail(a) {
  return a.slice(1)
}

function retreat (e) {
  return e.pop()
}

function hasLength (e) {
  return e.length
}

function any(ary, test) {
  for(var i in ary)
    if(test(ary[i]))
      return true
  return false
}

function equal(a, b) {
  if(a.length != b.length) return false
  for(var i in a)
    if(a[i] !== b[i]) return false
  return true
}

function getArgs(args) {
  return args.length == 1 ? args[0] : [].slice.call(args)
}

// return the index of the element not like the others, or -1
function oddElement(ary, cmp) {
  var c
  function guess(a) {
    var odd = -1
    c = 0
    for (var i = a; i < ary.length; i ++) {
      if(!cmp(ary[a], ary[i])) {
        odd = i, c++
      }
    }
    return c > 1 ? -1 : odd
  }
  //assume that it is the first element.
  var g = guess(0)
  if(-1 != g) return g
  //0 was the odd one, then all the other elements are equal
  //else there more than one different element
  guess(1)
  return c == 0 ? 0 : -1
}

exports.lcs = 
function lcs() {
  var cache = {}
  var args = getArgs(arguments)
 
  function key (a,b){
    return a.length + ':' + b.length
  }

  function recurse (a, b) {

    if(!a.length || !b.length) return []
    //avoid exponential time by caching the results
    if(cache[key(a, b)]) return cache[key(a, b)]

    if(a[0] == b[0])
      return [head(a)].concat(recurse(tail(a), tail(b)))
    else { 
      var _a = recurse(tail(a), b)
      var _b = recurse(a, tail(b))
      return cache[key(a,b)] = _a.length > _b.length ? _a : _b  
    }
  }

  if(args.length > 2) {
    //if called with multiple sequences
    //recurse, since lcs(a, b, c, d) == lcs(lcs(a,b), lcs(c,d))
    args.push(lcs(args.shift(), args.shift()))
    return lcs(args)
  }
  return recurse(args[0], args[1])
}

// given n sequences, calc the lcs, and then chunk strings into stable and unstable sections.
// unstable chunks are passed to build
exports.chunk =
function (q, build) {
  var q = q.map(function (e) { return e.slice() })
  var lcs = exports.lcs.apply(null, q)
  var all = [lcs].concat(q)

  function matchLcs (e) {
    return last(e) == last(lcs) || ((e.length + lcs.length) === 0)
  }

  while(any(q, hasLength)) {
    //if each element is at the lcs then this chunk is stable.
    while(q.every(matchLcs) && q.every(hasLength)) 
      all.forEach(retreat)

    //collect the changes in each array upto the next match with the lcs
    var c = false
    var unstable = q.map(function (e) {
      var change = []
      while(!matchLcs(e)) {
        change.unshift(retreat(e))
        c = true
      }
      return change
    })
    if(c) build(q[0].length, unstable)
  }
}

exports.diff =
function (a, b) {
  var changes = []
  exports.chunk([a, b], function (index, unstable) {
    var del = unstable.shift().length
    var insert = unstable.shift()
    changes.push([index, del].concat(insert))
  })
  return changes
}

exports.patch = function (a, changes, mutate) {
  if(mutate !== true) a = a.slice(a)//copy a
  changes.forEach(function (change) {
    [].splice.apply(a, change)
  })
  return a
}

// http://en.wikipedia.org/wiki/Concestor
// me, concestor, you...
exports.merge = function () {
  var args = getArgs(arguments)
  var patch = exports.diff3(args)
  return exports.patch(args[0], patch)
}

exports.diff3 = function () {
  var args = getArgs(arguments)
  var r = []
  exports.chunk(args, function (index, unstable) {
    var mine = unstable[0]
    var insert = resolve(unstable)
    if(equal(mine, insert)) return 
    r.push([index, mine.length].concat(insert)) 
  })
  return r
}

var rules = [
  function oddOneOut (changes) {
    changes = changes.slice()
    //put the concestor first
    changes.unshift(changes.splice(1,1)[0])
    var oddi = oddElement(changes, equal)
    if(oddi == 0) // concestor was different
      return changes[1]
    if (~oddi)
      return changes[oddi] 
  },
  //i've implemented this as a seperate rule,
  //because I had second thoughts about this.
  function insertMergeOverDelete (changes) {
    changes = changes.slice()
    changes.splice(1,1)// remove concestor
    
    //if there is only one non empty change thats okay.
    //else full confilct
    for (var i = 0, nonempty; i < changes.length; i++)
      if(changes[i].length) 
        if(!nonempty) nonempty = changes[i]
        else return // full conflict
    return nonempty
  }
]

function resolve (changes) {
  var l = rules.length
  for (var i in rules) { // first
    var c = rules[i](changes)
    if(c) return c
  }
  changes.splice(1,1) // remove concestor
  return {'?': changes}
}

