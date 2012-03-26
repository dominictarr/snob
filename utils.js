
exports.extend = function (a, b) {
    // copy b onto a
    for (var k in b)
      a[k] = b[k]
    return a
  }
exports.map = function (obj, itr) {
    var r = {}
    for (var i in obj)
      r[i] = itr(obj[i], i, obj)
    return r
  }

exports.copy = function (obj) {
    return exports.map(obj, function(e) {return e})
  }

exports.keys = function (obj) {
    var ks = []
    for (var k in obj)
      ks.push(k)
    return ks
  }
  
exports.max = function (ary, iter) {
    var M = null
    for(var k in ary) {
      var m = iter(ary[k],k,ary)
      if(M === null || m > M)
        M = m
    }
    return M
  }

