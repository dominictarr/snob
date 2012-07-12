/*
  connect two repos via streams,
  and check that the repos update each other when not paused.
*/


var Repo = require('../')
var A = new Repo()
var B = new Repo()

var es = require('event-stream')
var a = require('assertions')

var as = A.createStream()
var bs = B.createStream()

console.log(as, bs, as == bs)
as
  .pipe(es.log('A-B->'))
  .pipe(bs)
  .pipe(es.log('B-A->'))
  .pipe(as)

as.greet().pause()

var world

A.commit({hello: ['hi']})
A.commit(world = {hello: ['hi', 'HELLO']})

console.log(A.checkout())
console.log(B.checkout())

a.notDeepEqual(A.checkout(), B.checkout())
a.deepEqual(A.checkout(), world)

as.resume()

console.log(B.checkout())

a.deepEqual(A.checkout(), B.checkout())
B.commit(world = {hello: ['hi', 'hi, there', 'HELLO']})

console.log(A.checkout())
console.log(B.checkout())

a.deepEqual(A.checkout(), B.checkout())
a.deepEqual(A.checkout(), world)

bs.pause()

B.commit(world = {hello: ['hi', 'hi, there', 'Hello!']})

a.notDeepEqual(A.checkout(), B.checkout())
a.deepEqual(B.checkout(), world)

bs.resume()

console.log(A.checkout())
console.log(B.checkout())

a.deepEqual(A.checkout(), B.checkout())
a.deepEqual(A.checkout(), world)

bs.pause()
as.pause()

//merge conflict!

B.commit({hello: ['hi', 'Hello!']})
A.commit({hello: ['hi', 'Hello!', 'hullo']})

console.log(A.checkout())
console.log(B.checkout())

console.log(A.checkout())
console.log(B.checkout())

bs.resume()
as.resume()

console.log(A.checkout())
console.log(B.checkout())

//wow, it worked.
