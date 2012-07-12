module.exports = function (deps) {
  var a = deps.diff
  var hash = deps.hash
  var EventEmitter = require('events').EventEmitter
  var u = require('./utils')
  var createStream = require('./stream')

  function Repository () {
    this.commits = {}
    this.branches = {}
    this.tags = {}
    this.get = this.get.bind(this)
    this.getId = this.getId.bind(this)
    this.id = '#'+Math.random()
    this.remotes = {}
  }

  Repository.prototype = u.extend(new EventEmitter(), {
    commit: function (world, meta) {
      //meta is author, message, parent commit
      //commit will diff it with the head of the given branch/parent commit
      //and then save that diff in the commit list.

      if(!meta) meta = {parent: 'master'}
      var branch = meta.parent //save the branch name
      meta.parent = this.getId(branch) 
      var commit = u.copy(meta) // filter correct attributs only?
      commit.changes = this.diff(meta.parent, world)
      if(!commit.changes)
        throw new Error('there are no changes') 
      commit.depth = (this.commits[meta.parent] || {depth: 0}).depth + 1
      commit.timestamp = Date.now()
      commit.id = hash(commit)

      this.addCommits([commit], branch)
 
      return commit
    },
    get: function (commitish) {
      return this.commits[commitish] || 
        this.commits[this.branches[commitish] || this.tags[commitish]]
    },
    getId: function (commitish) {
      return (this.get(commitish) || {id:null}).id 
    },
    tag: function (name, commitish) {
      if(this.commits[name] || this.branches[name]) return
      this.tags[name] = this.getId(commitish) 
    },
    branch: function (name, commitish) {
      // do not save this as a branch if it's actually a commit, or a tag.
      if(this.commits[name] || this.tags[name]) return
      return this.branches[name] = this.getId(commitish) || this.branches[name]
    },
    diff: function (parent, world) {
      var head = this.checkout(parent)
      if('object' !== typeof world)
        world = this.checkout(world)
      return a.diff(head, world)
    },
// revlist (head, since)
// @head -- commitish
// @since -- commitish (optional)
//
// return list of commit (ids) for head
// that come after @since.
// TODO: allow since to be an revlist.
// TODO: throw an error if head  or since is unknown.
// if it doesn't know anything in since, it will send the whole array.
    revlist: function (head, since) {
      var id = this.getId(head) // coerse to commit
      var revlist = []
      var exclude = (
          Array.isArray(since) ? since 
        : since ? this.revlist(since) 
        : []
      )
      var self = this
      function recurse (id) {
        if( ~revlist.indexOf(id) || !id) return
        if(~exclude.indexOf(id)) return
        var commit = self.get(id)
        if(!commit.merged) //one parent
          recurse(commit.parent)
        else
          commit.merged.forEach(recurse)
        revlist.push(id)
      }
      recurse(id)
      return revlist
    },
// same as revlist, but return the revs themselves.
    getRevs: function (head, since) {
      return this.revlist(head, since).map(this.get)
    },
// send revs to remote.
    send: function (rId, branch) {
      var revs = this.getRevs(branch, this.remote(rId, branch))
      return revs
    },
// process revs sent by send
    recieve: function (revs, branch, allowMerge) { 
      var last = revs[revs.length - 1]
      if(!last) return 
      this.emit('preupdate', revs, branch)
      var ff = this.isFastForward(branch, revs)
      var id = last.id
      if(!allowMerge && !ff)
        throw new Error('recieved non fast-forward. pull first')
      if(ff) {
        this.addCommits(revs, branch)
      } else {
        this.addCommits(revs)
        revs.push(this.merge([branch, id]))
      }
      return id
    },
// clone another repo
// works inmemory, used to test.
    clone: function (remote, branch) {
      //branch = branch || 'master'
      for(var j in this.commits)
        throw new Error('can only clone on an empty repo')
      if(!branch)
        throw new Error('expect branch to clone')
     
      var id = this.recieve(remote.send(this.id, branch), branch, false)
      this.remote(remote.id, branch, id)
      remote.remote(this.id, branch, id)
    },
    push: function (remote, branch) {
      var id = remote.recieve(this.send(remote.id, branch), branch, false)
      remote.remote(this.id, branch, id)
      this.remote(remote.id, branch, id)
    },
    pull: function (remote, branch) {
      var id = this.recieve(remote.send(this.id, branch), branch, true)
      remote.remote(this.id, branch, id)
      this.remote(remote.id, branch, id)
    },
// isFastForward (head, revlist)
// @head (commitish) -- potential ancestor
// @revlist          -- revs, possibly since head.
//
// return true if head is in revlist.
    isFastForward: function (head, revlist) {
      //return the nodes of revlist that fast-forward head.
      // revlist two is a ff if head is an ancestor.
      head = this.getId(head)
      for(var i in revlist) {
        var rev = (
          'object' == typeof revlist[i] 
            ? revlist[i] : this.get(revlist[i])
        )
        if(rev 
        && rev.parent == head
        || rev.id == head
        || rev.merged 
        && ~rev.merged.indexOf(head)) return true
      }
      return false
    },
// concestor (heads)
// heads (array of commitish)
// 
// find the commit that is the common ancestor of every commit
// in heads
    concestor: function (heads) { //a list of commits you want to merge
      if(arguments.length > 1)
        heads = [].slice.call(arguments)
      // find the concestor of the heads
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
      function find (h) {
        var i = ~l ? revlist.lastIndexOf(h) : revlist.lastIndexOf(h, l)
        if(i !== -1) return l = i
        else if(!commits[h]) return //?
        else find(commits[h].parent) //this needs to check through the merges properly.
      }
      while(heads.length)
        find(heads.shift())
      return revlist[l]
    },
// addCommits (commits, branch)
// 
// add commits to branch
   addCommits: function (commits, branch) {
      //iterate through commits
      var self = this
      var revs = []
      commits.forEach(function (e) {
        if('object' !== typeof e) throw new Error(e + ' is not a commit')
        if(self.commits[e.id]) return
        if(self.commits[e.parent] || e.parent == null)
          revs.push(self.commits[e.id] = e)
        else
          throw new Error('dangling commit:' + e.id + ' ' + JSON.stringify(e)) // should never happen.
      })
      if(branch) this.branch(branch, commits[commits.length - 1].id)
      if(revs.length) { 
        if(!this._initialized)
          this.emit('initial', revs, branch), this._initialized = true
        this.emit('update', revs, branch)
      }
    },
    merge: function (branches, meta) { //branches...
      var self = this
      var mine = branches[0]
      // ensure that merging the same branches produces the same merge commit.
      branches = branches.map(this.getId).sort()
      var concestor = this.concestor(branches)
      if(!concestor)
        throw new Error('don\'t have concestor for :' + branches)
      branches.splice(1, 0, concestor)
      var commit = meta ? u.copy(meta) : {}
      var checkouts = branches.map(function (e) {
        return self.checkout(e)
      })
      commit.changes = a.diff3(checkouts)
      if(!commit.changes)
        throw new Error('there are no changes') 
      commit.merged = branches.slice()
      commit.merged.splice(1,1) //concestor should not be in merged
      commit.parent = concestor //this.getId(branches[0])
      commit.depth = this.get(branches[0]).depth + 1
      //set the timestamp to be one greater than the latest commit,
      //so that merge commits are deterministic
      console.log('BRINCHES',branches)
      commit.timestamp = u.max(branches, function (e) { return self.get(e).timestamp }) + 1

      commit.id = hash(commit)

      this.addCommits([commit], mine)
      return commit
    },
    checkout: function (commitish) {
      //idea: cache recently hit checkouts
      //will improve performance of large merges
      commitish = commitish || 'master'
      var commit = this.get(commitish)
      if(!commit) return {}
      var state = commit.parent ? this.checkout(commit.parent) : {}
      return a.patch(state, commit.changes)
    },
    remote: function (id, branch, commit) {
      var remotes = 
        this.remotes[id] = this.remotes[id] || {}
      return remotes[branch] = commit || remotes[branch]
    },
    sync: function (obj, opts) {
      if(!obj)
        throw new Error('expected object to sync')
      opts = opts || {}
      var branch = opts.branch || 'master'
      var interval = opts.interval || 1e3
      var self = this
      this._sync = this._sync || []
      var syncr = {
        obj: obj,
        remoteUpdate: function () {
          var _obj = self.checkout(branch)
          var delta = a.diff(obj,_obj) 
          if(!delta) return
          if(delta) a.patch(obj, delta, true)
          if(opts.onUpdate)
            opts.onUpdate()
        },
        //check for local updates
        localUpdate: function() {
          if(opts.onPreUpdate)
            opts.onPreUpdate()
          try {
            self.commit(obj)  
          } catch (e) {
            if(!/no changes/.test(e.message)) throw e
          }
        },
        stop: function () {
          self.removeListener('update', syncr.remoteUpdate)
          self.removeListener('preupdate', syncr.localUpdate)
          clearInterval(syncr.check)
        }
      }
      if(interval > 0)
        syncr.ticker = setInterval(syncr.check, interval)
      this.on('update', syncr.update)
      this.on('preupdate', syncr.check) 
      this._sync.push(syncr)
      syncr.update() //incase there is something already there.
      return syncr
    },
    unsync: function (obj) {
      this._sync.forEach(function (e) {
        if(e.obj === obj)
          e.stop()
      })
    },
    createStream: function (opts) {
      return createStream(this, opts)
    }
  })

  return Repository
}
