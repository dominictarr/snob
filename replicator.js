/*
  this wraps a snob repo,
  and adds push, pull, fetch, and the ability to replicate in real time.

  lets begin with an inmemory implementation; just proxy changes to another instance.

*/

module.exports = function (hooks) {

function clone(obj) { // simulate being sent over the wire
  if('undefined' == typeof obj)
    return null
  return JSON.parse(JSON.stringify(obj))
}

function delay (fn) {
  return function () {
    var args = [].slice.call(arguments)
    var self = this
    setTimeout(function() {
      fn.apply(self, args)
    }, 0)
  }
}

function Replicator (repo) {
  this.repo = repo
}

var proto = Replicator.prototype = {} // new EventEmitter() ? 

proto.push = function (remote, callback) {
  var self = this
  // this should cache the remote heads, to save a round trip
  // if possible
  remote.heads(function (err, heads) {
    var desc = self.repo.decendants(heads)
    remote.add(desc, callback)
  })
}

function keys (obj) {
  var keys = []
  for(var k in obj)
    keys.push(k)
  return keys
}
// pre and post.
// pre can veto, post can change return value

hooks.preadd = hooks.preadd || noop
hooks.postadd = hooks.postadd || noop

function noop (commits, pulled, callback) {
  callback(null)
}
/*
function applyHooks (commits, pulled, fn, callback) {
  var self = this
  hooks.preadd.call(self, commits, pulled, function (err) {
    if(err) return callback(err)
    fn.call(self, commits,
  })
}
*/
proto.pull = function (remote, callback) {
  var self = this
  var heads = keys(this.repo.heads())
  remote.decendants(heads, function (err, commits) {
    //here we want to check if changeset follows from master
    //trigger pre/post-recieve ? I'm the local
    if(err) return callback(err)

    //just make prepull/postpull ?
    hooks.preadd
      .call(self, commits, true, function (err) {
        if(err) return callback(err)
        var res = self.repo.add(commits) //adds directly
        hooks.postadd
          .call(self, commits, true, callback)
      })

  })
}

proto.heads = function (callback) {
 delay(callback)(null, clone(keys(this.repo.heads())))
}

proto.decendants = function (heads, callback) {
  delay(callback)(null, this.repo.decendants(heads))
}

/*
  it's possible that the commits being added do not follow straight
  from master on this instance.
  when that happens, I want to merge (by whatever system) and then
  send the merged commits back, to say: merge this to be in sync with me.

  that will be best achived with some plugin system.
  it may be that the user should decide how to merge.
  (in many, non source code management situations, automatic may be fine)

  postadd - check if the first commit is in follows from master,
  if it does not - 
    a) merge it, and then send back the new commits
      - don't append to master if there is a conflict.
        (maybe we want the sender to handle that?)
    b) reject the change.

  okay, TIME TO COME CLEAN

  this is not really a git port. 

  this is a data model framework, based on the architecture of git.
  it's not just limited to list structured data. (aka, text files)

  this is why I want flexible ways to handle replication.

okay - handle git like behavior
  post pull - merge with branch || master,
  pre add / pre recieve
    - check if commits fastforward, if not refuse the commit
    - send back error that says to pull first.

  this distinguishes between client and server, the server being more anal. 
  how does a repo know whether it's the local or remote in each case?

okay - handle auto replication & merging.
        here the idea is to replicate a data set always sending commits
        if someone gets pushed an old commit it merges that commit and pushes back
        the merge.
        hmm, if a pushed commit contains a merge of a commit you have, rebase commits
        after that commit and send the rebase back.

          -- maybe just let a repo send back more commits in the response to a push?

  post pull - if master is not a fast-forward of remote, merge mine to thiers
              should now have a fast-forward, so send that.
*/

proto.add = function (commits, branch, callback) {
  if(!callback) callback = branch, branch = 'master' // ?
  //pre-recieve, I'm the remote
  var self = this
  hooks.preadd.call(this, commits, false, function (err) {
    if(err) return callback(err)
    self.repo.add(commits)
    hooks.postadd.call(self, commits, false, callback)
  })
}

proto.replicate = function (remote) {
  // now! need event emitter
  // keep track of the remote's heads,
  // only push commits if you don't think the remote has them.
  // for that it makes sense to be able to send a list of your heads?
  var self = this
  this.pull(remote, function (err) {
    self.repo.on('commit', function (commit) {
      //check if commit is a decendant of the remote's heads
      //this needs to be queued
      self.push(remote) 
    })
  })
  remote.replicate(this)
}

/*
  okay, so there are request/responses flowing both ways.
  there should be multiple ways to implement this.
  dnode
  socket.io
  longpolling http
  tcp
  0mq
*/
  return Replicator
}
