
var assert = require('assert')
var a = require('assertions')
var Docuset = require('../docuset')
var es = require('event-stream')
var Stream = require('stream').Stream
a.isFunction (Docuset)

var d = new Docuset()
var e = new Docuset()

a.has(d, {
  repos: a._isTypeof('object'),
  createRawHandler: a._isFunction(),
  handler: a._isFunction(),
  createHandler: a._isFunction()
})

var fun = a._isFunction()

var validCon = a._has({
  sub: fun, unsub: fun
})

var validRepo = a._has({
  commit: fun, merge: fun, revlist: fun, recieve: fun, send: fun,
  checkout: fun
})

var toD = es.through()
var toE = es.through()

//connect the output of d to the input of e and vice versa.
function contract() {
  var count = 0
  var contracts = {}
  return {
    isCalled: function (fun, name) {
      name = name || count ++
      contracts[name] = false
      return function () {
        var args = [].slice.call(arguments)
        fun.apply(this, args)
        contracts[name] = true
      }
    },
    validate: function () {
      for (var k in contracts) {
        if(!contracts[k])
          throw new Error('contract ' + JSON.stringify(k) + ' not satisified')
      }
    }
  }
}

d.on('connection', console.log)

d.createRawHandler(validCon)(toD, toE)

e.createRawHandler(function (con){
  validCon(con)
  var c = contract()

  toD.once('data', c.isCalled(function (data) {
    a.has(data, ['SUB', 'test', {}])
  }, 'update is emitted on .sub()'))
 
  d.once('new', c.isCalled(function (repo) {
    validRepo(repo)
  }, "'new' event is emitted"))
 
  var repo = con.sub('test')
  c.validate()
  validRepo(e.repos.test)
  validRepo(d.repos.test)
  var state = {hello: ['test']}

  repo.once('update', c.isCalled(function (revs, branch) {
    a.equal(branch, 'master')
    a.isArray(revs)
  }, 'repo emits update'))

  toD.once('data', c.isCalled(function (data) {

    a.has(data, ['UPDATE', 'test', 'master', []])
  }, 'UPDATE is sent'))

  //make a commit on the E side.
  repo.commit(state, {parent: 'master'})

  c.validate()

  a.deepEqual(d.repos.test.getRevs('master'), repo.getRevs('master'))
  
  a.deepEqual(repo.checkout('master'), state)
  a.deepEqual(
    repo.checkout('master'), 
    d.repos.test.checkout('master')
  )

  //the repos have been syncronised!

  var dData = d.repos.test.checkout('master')
  dData.goodbye = ['test2']

  toE.once('data', c.isCalled(function (data) {
    a.has(data, ['UPDATE', 'test', 'master', []])
  }, 'UPDATE is sent 2'))

  e.repos.test.once('update', c.isCalled(function (revs, branch) {
    a.equal(branch, 'master')
  }, 'update is emitted'))

  //make a commit on the D side

  d.repos.test.commit(dData, {parent: 'master'})
 
  c.validate()
 
  a.deepEqual(d.repos.test.getRevs('master'), repo.getRevs('master'))
  console.log(d.repos.test.getRevs('master'), repo.getRevs('master'))
  a.equal(repo.branch('master'), d.repos.test.branch('master'))
  a.deepEqual(repo.checkout('master'), d.repos.test.checkout('master'))


})(toE, toD)


