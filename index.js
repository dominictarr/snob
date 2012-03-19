
/*
  dependency injection for the server side.

*/

var a = require('adiff')

var createHash = require('crypto').createHash 

function hash (obj) {
  return createHash('sha').update(JSON.stringify(obj)).digest('hex')
}

module.exports = require('./snob')({
  adiff: a,
  hash: hash
})

