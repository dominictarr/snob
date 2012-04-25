

var io = require('socket.io')
var connect = require('connect')
var _bs = require('browser-stream')
var app = connect()
      .use(connect.static(__dirname))

io = io.listen(app.listen(3000))

//app.listen(8080)

var Docuset = require('snob/docuset')
var doc = new Docuset()

/* 
_bs(io).on('connect', function (bs) {
  bs.on('open', function (stream) {
    
  })
})
*/



io.sockets.on('connection', function (sock) {
  
  var bs = _bs(sock)
  var repo = doc.createRepo('test')
  doc.createServer(bs)
  console.log('CONNECTION', bs)
  bs.on('connection', function (stream) {
    console.error('BROWSER-STREAM', stream)
    stream.on('data', function (data) {
      console.error('DATA', data)
    })
  })
 

  repo.on('update', function () {
    console.log('---------', new Date())
    console.log(repo.branch('master'))
    console.log(repo.checkout())
  })
  
})
