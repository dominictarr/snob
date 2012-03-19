var a = require('adiff')

function map(obj, itr) {
  var r = {}
  for (var i in obj)
    r[i] = itr(obj[i], i, obj)
  return r
}

function copy(obj) {
  return map(obj, function(e) {return e})
}
function keys (obj) {
  var ks = []
  for (var k in obj)
     ks.push(k)
  return ks
}

module.exports = {
  diff: function (older, newer) {
    return map(newer, function (n, k){
      return a.diff(older[k] || [], n)
    })
  },
  diff3: function (branches) { //mine, concestor, yours,...
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
        return o[k]
      })
      changes[k] = a.diff3(collect)
    })
    return changes
  },
  patch: function (obj, changes) {
    return map(changes, function (change, key) {
      return a.patch(obj[key] || [], change)
    })
  }
}
