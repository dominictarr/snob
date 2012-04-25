
var bs = require('browser-stream')(io.connect('http://localhost:3000'))
var Docuset = require('snob/docuset')
var doc = new Docuset()

SNOB = doc.createHandler()(bs.createStream({writable: true, readable: true, name: 'test'}))

REPO = SNOB.sub('TEST')

