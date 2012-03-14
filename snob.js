var a = require('./index')
// reimplementing git, because I'm insane.

function Repository () {
  this.commits = {},
}

function map(obj, itr) {
  var r = {}
  for (var i in obj) {
    r[i] = itr(obj[i], i, obj)
  }
  return r
}

function copy(obj) {
  return map(obj, function(e) {return e})
}
function keys (obj) {
  var ks = []
  for (var k in obj)
    ks.push(k)
  return ks
}

var createHash = require('crypto').createHash
function hash (obj) {
  return createHash('sha').update(JSON.stringify(obj)).digest('hex')
}

Repository.prototype = {
  commit: function (world, meta) {
    //meta is author, message, parent commit
    //this is the current state of the repo.
    //commit will diff it with the head of the given branch 
    //and then save that diff in the commit list.

    // head = checkout (branch)
    // diff(head, world)
    // bundle with meta, add to commits 
    var commit = copy(meta) // filter correct attributs only?
    commit.changes = this.diff(meta.parent, world)
    commit.depth = (this.commits[meta.parent] || {}).depth + 1
    commit.id = hash(commit)

    this.commits[commit.id] = commit
    return commit
      // emit the new commit
    }
  },
  diff: function (parent, world) {
    var head = this.checkout(parent)
    return map(world, function (b, f) {
      return a.diff(head[f] || [], b)
    })
  },
  revlist: function (id) {
    if(!id) return []
    var commit = this.commits[id]
    return this.revlist(commit.parent).concat(id)
  }
  concestor: function () { //commits
    // find the concestor of the commits.
    // this is the only interesting problem left!
    // get the revlist of each commit
    // iterate over each revlist and find last commit
    // that matches the first revlist, that is <= the current max.
    // return the concestor
  },
  merge: function () { //branches...
    // find the concestor of the branches,
    // then calculate an n-way merge of all the checkouts.
  },
  checkout: function (name) {
    if(name == null)
      return {}
    var commit = this.commits[name]
    return a.patch(this.checkout(commit.parent), changes.changes)
  },
  heads: function () {
    var heads = {}
    heads = copy(this.commits)
    for (var k in this.commits)
      delete heads[this.commits[k].parent] 
    return heads 
    //return commits that have no children
  }
}

exports.init = function () {

  return new Repository ()

}
