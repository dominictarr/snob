var a = require('./index')
// reimplementing git, because I'm insane.

function Repository () {
  this.commits = {}
}

function map(obj, itr) {
  var r = {}
  for (var i in obj)
    r[i] = itr(obj[i], i, obj)
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
    commit.depth = (this.commits[meta.parent] || {depth: 0}).depth + 1
    commit.id = hash(commit)

    this.commits[commit.id] = commit
    return commit
      // emit the new commit 
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
  },
  concestor: function (heads) { //a list of commits you want to merge
    if(arguments.length > 1)
      heads = [].slice.call(arguments)
    // find the concestor of the heads
    // this is the only interesting problem left!
    // get the revlist of the first head
    // recurse down from each head, looking for the last index of that item.
    // chop the tail when you find something, and move to the next head.
    // the concestor(a, b, c) must equal concestor(concestor(a, b), c)
    heads = heads.slice()
    var first = heads.shift()
    var revlist = this.revlist(first)
    var commits = this.commits
    function last (a) {
      return a[a.length - 1]
    }
    function find (h) {
      if(!revlist.length) return
      var i = revlist.lastIndexOf(h)
      if(i !== -1) {
        revlist.splice(i + 1) //shorten the list 
        return
      }// am assuming, that there is always a concestor
      find(commits[h].parent)
    }
    while(heads.length)
      find(heads.shift())
    return last(revlist)
  },
  merge: function (branches, meta) { //branches...
    // find the concestor of the branches,
    // then calculate an n-way merge of all the checkouts.
    var concestor = this.concestor(branches)
    branches.splice(1, 0, concestor)
    var self = this
    var commit = copy(meta)
    var checkouts = branches.map(function (e) {
      return self.checkout(e)
    })
    commit.changes = map(checkouts[1], function (obj, key) {
      var collect = checkouts.map(function (e) {
        return e[key]
      })
      return a.diff3(collect)
    })
    //TODO build the commit, and stick it in.
    
    commit.merged = branches
    commit.parent = branches[0]
    commit.id = hash(commit)
    commit.depth = this.commits[branches[0]].depth + 1
    this.commits[commit.id] = commit
    return commit
  },
  checkout: function (name) {
    if(name == null)
      return {}
    var commit = this.commits[name]
    var state = this.checkout(commit.parent)
    return map(commit.changes, function (change, key) {
      return a.patch(state[key] || [], change)
    })
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

module.exports = Repository
