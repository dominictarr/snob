

var D = require('../docuset')
var d = D()
d.createServer().listen(4242)
var r = d.createRepo('t')
var s = D().connect(4242).sub('t')


var obj = {}
var obj2 = {}

r.sync(obj)
s.sync(obj2)
obj.h = {__id__: 'onaehu'}
setTimeout(function (e) {
  obj2.h = [undefined]
}, 2)
