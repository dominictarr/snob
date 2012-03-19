
/*
  dependency injection for the server side.

*/

var a = require('./xdiff')

var createHash = require('crypto').createHash 

function hash (obj) {
  return createHash('sha').update(JSON.stringify(obj)).digest('hex')
}

module.exports = require('./snob')({
  diff: a,
  hash: hash
})

