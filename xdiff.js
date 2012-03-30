var a = require('adiff')

function map(obj, itr) {
  var r = {}
  for (var i in obj)
    r[i] = itr(obj[i], i, obj)
  return r
}
/*
  to expand this into a real "database",
  also need {} objects.

  there are alot more possibilities when those get added to the mix.

  consider this:
  var older = 
    { a: {},
    , b: { hello: 'birthday message' } }
  var newer = 
    { a: { hello: 'birthday message' },
    , b: {} }

  what has happened here?
  have we set a.hello = 'birthday message'
  and b = {}
  or have we set a = b; b = {}

  detecting a move is computationally expensive, and ambigious.

  thinking about this, i've decided that a reasonable compromise is to only
  handle moves when the object in question has an id (of some kind), and otherwise,
  to assume each change to an object is a set.

*/
exports = module.exports = function (deps, exports) { 
  exports = exports || {}
  var a = require('adiff')(deps)
  console.log(a)
  exports.diff =
    function (older, newer) {
      var didChange = false
      var change = map(newer, function (n, k){
        var ch = a.diff(older[k] || [], n)
        if(ch.length)
          didChange = true
        return ch
      })
      if(!didChange) return null
      return change
    }
  exports.diff3 =
    function (branches) { //mine, concestor, yours,...
      if(arguments.length > 1)
        branches = [].slice.call(arguments)
      //collect the keys
      var keys = []
      branches.forEach(function (e) {
        for (var k in e) 
          if(!~keys.indexOf(k)) keys.push(k)
      })
      var changes = {}
      keys.forEach(function (k) {
        var collect = branches.map(function (o) {
          return o[k] || []
        })
        changes[k] = a.diff3(collect)
      })
      return changes
    }
  exports.patch = 
    function (obj, changes) {
      return map(changes, function (change, key) {
        return a.patch(obj[key] || [], change)
      })
    }
  return exports
}

exports(null, exports)
