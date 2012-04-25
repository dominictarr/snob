/*
  TEST THAT QUERIES PRODUCE THE CORRECT RESPONSES

  write a message
  call a function
*/

var Docuset = require('../docuset')
var es = require('event-stream')
var a = require('assertions')
var Repo = require('../')

function assertStream() {
  var c = 0
  var stream = es.mapSync(function (data) {
    console.log(data, stream.queue)
    c ++
    if(!stream.queue.length)
      throw new Error('need an assertion for chunk ' + c)
    var exp = stream.queue.shift()
    if('object' === typeof a)
      a.has(data, exp)
    else if('function' == typeof a)
      exp(data)
    else
      throw new Error('assertion should be object or function for chunk' + c)
  })
  stream.queue = []
  return stream
}

function assertDocuset (name, test) {
  var d = new Docuset()
  var ins = es.stringify()
  var outs = es.parse()
  var d = new Docuset()
  d.createHandler()(ins, outs)
  var as = assertStream()
  outs.pipe(as)
  console.log('TEST:', name)
  test(d, ins, as) 
}

assertDocuset('simple', function (d, ins, out) {
  out.queue.push(['UPDATE', 'hello', 'master', a._isArray()])
  ins.write(['SUB', 'hello', {}])
  d.createRepo('hello').commit({a: 1})
})

assertDocuset('sub after', function (d, ins, out) {
  out.queue.push(['UPDATE', 'hello', 'master', a._isArray()])
  d.createRepo('hello').commit({a: 1})
  ins.write(['SUB', 'hello', {}])
})

assertDocuset('sub after 2 commits', function (d, ins, out) {
  out.queue.push(['UPDATE', 'hello', 'master', a._property('length', 2)])
  var r = d.createRepo('hello')
  r.commit({a: 1})
  r.commit({a: 2})
  ins.write(['SUB', 'hello', {}])
})

assertDocuset('sub then update', function (d, ins, out) {

  var r = new Repo()
  var a1 = r.commit({a: 1})
  var a2 = r.commit({a: 2})

  ins.write(['SUB', 'hello', {}])
  ins.write(['UPDATE', 'hello', 'master', [a1, a2]])
  //this should not write back the update.
  //because it should remember that I've sent those updates.
  //but currently, it calls writes 'update' before it returns
  //from recieve. need to queue that instead.
})

