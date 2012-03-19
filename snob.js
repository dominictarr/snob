module.exports = function (deps) {
var a = deps.diff
var hash = deps.hash
// reimplementing git, because I'm insane.

function Repository () {
  this.commits = {}
  this.branches = {}
  this.tags = {}
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

Repository.prototype = {
  commit: function (world, meta) {
    //meta is author, message, parent commit
    //this is the current state of the repo.
    //commit will diff it with the head of the given branch 
    //and then save that diff in the commit list.

    // head = checkout (branch)
    // diff(head, world)
    // bundle with meta, add to commits 
    var branch = meta.parent //save the branch name
    meta.parent = this.getId(branch) 
    var commit = copy(meta) // filter correct attributs only?
    commit.changes = this.diff(meta.parent, world)
    commit.depth = (this.commits[meta.parent] || {depth: 0}).depth + 1
    commit.timestamp = Date.now()
    commit.id = hash(commit)

    // XXX make an error if the commits are empty !!! XXX 

    this.commits[commit.id] = commit
    this.branch(branch, commit.id)
    return commit
      // emit the new commit 
  },
  get: function (commitish) {
    return this.commits[commitish] || this.commits[this.branches[commitish] || this.tags[commitish]]
  },
  getId: function (commitish) {
    return (this.get(commitish) || {id:null}).id 
  },
  tag: function (name, commitish) {
    this.tags[name] = this.getId(commitish) 
  },
  branch: function (name, commitish) {
    // do not save this as a branch if it's actually a commit, or a tag.
    if(this.commits[name] || this.tags[name]) {
      return this.getId(commitish)
    }
    return this.branches[name] = this.getId(commitish)
  },
  diff: function (parent, world) {
    var head = this.checkout(parent)
    if('object' !== typeof world)
      world = this.checkout(world)
    return a.diff(head, world)
  },
  revlist: function (id) {
    var commit = this.get(id)
    if(!commit) return []
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
    var getId = this.getId.bind(this)
    heads = heads.map(getId)
    var first = heads.shift()
    var revlist = this.revlist(first)
    var commits = this.commits
    var l =  -1
    function last (a) {
      return a[a.length - 1]
    }
    function find (h) {
      var i = revlist.lastIndexOf(h, ~l ? l : null)
      if(i !== -1) l = i
      else find(commits[h].parent)
    }
    while(heads.length)
      find(heads.shift())
    return revlist[l]
  },
  merge: function (branches, meta) { //branches...
    // TODO, the interesting problem here is to handle async conflict resolution.
    // hmm, maybe just mark the conflicts but do not update the branch?
    // afterall, this isn't really for SCM, the usecases are usally gonna take automatic resolves.
 
    // find the concestor of the branches,
    // then calculate an n-way merge of all the checkouts.
    var self = this
    branches.map(function (e) {
      return self.getId(e)
    })
    var mine = branches[0]
    var concestor = this.concestor(branches)
    branches.splice(1, 0, concestor)
    var self = this
    var commit = meta ? copy(meta) : {}
    var checkouts = branches.map(function (e) {
      return self.checkout(e)
    })
    commit.changes = a.diff3(checkouts)
    
    commit.merged = branches
    commit.parent = this.getId(branches[0])
    commit.depth = this.get(branches[0]).depth + 1
    commit.timestamp = Date.now()

    commit.id = hash(commit)

    this.commits[commit.id] = commit
    this.branch(mine, commit.id) // if this was merge( ['master', ...], ...) update the branch
    return commit
  },
  checkout: function (commitish) {
    //idea: cache recently hit checkouts
    //will improve performance of large merges
    if(commitish == null)
      return {}
    var commit = this.get(commitish)
    var state = this.checkout(commit.parent)
    return a.patch(state, commit.changes)
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

return Repository
}
