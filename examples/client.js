
var bs = require('browser-stream')(io.connect('http://localhost:3000'))
var Docuset = require('snob/docuset')
var doc = new Docuset()
var SNOB

/*
  since there is only one connection from the browser 
  why not go:

  var d = Docuset().connect('http://localhost:3000')

  var repo = d.sub('name')

*/

doc.createHandler(function (con) {
  SNOB = con
})(con)


