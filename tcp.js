
var Repo = require('./')
var net = require('net')
var es = require('event-stream')
var s = new Repo()

var server = net.createServer(function (con) {
  con.pipe(es.split()).pipe(es.map(function (data) {
    data = JSON.parse(data)
    // data should be a list of commits.
    /*
      [senderId, branch, revs]
    */
//i    var rId = data[2], branch = data[1], revs = data[0]
    
    var id = s.recieve(data, 'master')
    console.log('RECIEVED:', s.checkout('master'))
  }))
}).listen(8282, function () {

  var info = {messages: []}
  var c = new Repo()

  var client = net.createConnection(8282, function () {
  
    setInterval(function () {
      info.messages.push('' + new Date())
      if(info.messages.length > 5)
        info.messages.shift()
      c.commit(info, {parent: 'master'})
      var data = JSON.stringify(c.send(s.id, 'master'))
      s.remote(s.id, 'master', c.branch('master'))
      client.write(data+'\n')
    }, 590)

  })

})
