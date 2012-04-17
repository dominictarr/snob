

var createHash = require('crypto').createHash 
function hash (obj) {
  return createHash('sha').update(JSON.stringify(obj)).digest('hex')
}

var Docuset = require('./docuset')
var net = require('net')
var es = require('event-stream')
var _s

var data = {
  list: []
}

// alternative Repo with a shorter hash.

var Repo = require('./').inject({
  hash: function (commit) {
    return '#'+hash(commit).substring(0,10)
  }
})

var opts = {
  createRepo: function (key) {
    return new Repo()
  }
}

var a = new Docuset(opts)
var b = new Docuset(opts)

Docuset.prototype.createServer = function () {
  this._server = net.createServer(this.createHandler())
  return this._server
}

Docuset.prototype.createConnection = 
Docuset.prototype.connect = function () {
  var args = [].slice.call(arguments)
  var soc = net.createConnection.apply(null, args)
  var con = this.createHandler()(soc)

  con._socket = soc

  return con
}

var server = a.createServer().listen(8282, function () {

  var con = b.connect(8282)
  repo = con.sub('test')
  repo.commit({list: [1,2,3]}, {parent: 'master'})

})

function checkSynced(_, source) {
  console.log( 
    a.repo.branch('master') == b.repo.branch('master')
    ? 'SYNCED'
    : 'UN-SYNCED', source
  ) 
}

/*setInterval(function () { 
  data.list.push(data.list.length)
  repo.commit(data, {parent: 'master'})
  console.log('data', data)
}, 1e3)
*/

setInterval(function () {
  var repo = b.repos.test
  var data = repo.checkout('master')
  data.list.push(data.list.length)
  repo.commit(data, {parent: 'master'})
}, 1e3)


//okay, I'm still having problems sending commits when out of sync.
//like if a merge arrives but don't have it's parents?


//TODO injectable merge rules!
//and allow appends in adiff

//setTimeout(function() {
  setInterval(function () {
    var repo = a.repos.test
    var data = repo.checkout('master')
    data.list.unshift('!')
    repo.commit(data, {parent: 'master'})
  }, 2e3)
//}, 0)

