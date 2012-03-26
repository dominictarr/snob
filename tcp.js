
var Docuset = require('./docuset')
var net = require('net')
var es = require('event-stream')
var _s

var data = {
  list: []
}

var a = new Docuset()
var b = new Docuset()

var server = net.createServer(a.createHandler())
server.listen(8282, function () {
  var client = net.createConnection(8282, function () {
      b.createHandler(function (con) {
        var repo = con.sub('test')
        repo.commit({list: [1,2,3]}, {parent: 'master'})
      })(client)
    }
  ) 
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

