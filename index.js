
/*
  dependency injection for the server side.

*/

var a = require('xdiff')

var createHash = require('crypto').createHash 
function hash (obj) {
  return createHash('sha').update(JSON.stringify(obj)).digest('hex')
}

var defaults = {
  diff: a,
  hash: hash,
}

var _inject = require('./repo')

function inject (opts) {
  opts = opts || {}
  for (var k in defaults)
    opts[k] = opts[k] || defaults[k]
  return _inject(opts)
}

module.exports = inject()
module.exports.inject = inject
