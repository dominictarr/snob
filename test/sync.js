

var Repo = require('../')
var es = require('event-stream')

var r = new Repo() 
var s = new Repo()

var rs = r.createStream()
var ss = s.createStream()

rs
  .pipe(es.log('--->'))
  .pipe(ss)
  .pipe(es.log('<---'))
  .pipe(rs)

var obj = {}
var obj2 = {}

r.sync(obj)
s.sync(obj2)
var ts
obj.h = {__id__: 'onaehu'}
setTimeout(function (e) {
  obj2.h = [ts = new Date() + '']
}, 200)


r.on('sync', function () {
console.log(obj)
console.log(obj2)
})

r.on('update', function () {
  console.log('1', obj)
  console.log('2', obj2)

  if(obj.h.length === 0) {
    r.unsync()
    s.unsync()
  }
  if(obj.h.length && obj.h.shift() == ts)
    console.log('yes')
})

