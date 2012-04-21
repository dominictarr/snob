
var d = require('../inmem')
var assert = require('assert')
var server = d().createServer().listen()
var client = d().connect(server)

var r = client.sub('hello')
//would be nice to just default to {parent: 'master'}
//oh, will probably be adding author too...
r.commit({a: true})

r.commit({a: 2})

var m = server.repos.hello.checkout()

assert.deepEqual(m, {a: 2})

// a second connection to the hello document!

var client2 = d().connect(server)
var r2 = client2.sub('hello')
assert.deepEqual(r2.checkout(), {a: 2})

r2.commit({a: 2, b: 3})

assert.deepEqual(r.checkout(), {a: 2, b: 3})
