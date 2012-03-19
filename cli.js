#! /usr/bin/env node

var fs = require('fs')
var join = require('path').join
var Repo = require('./')
var optimist = require('optimist')

// just for a joke, lets add a CLI so that snob can be self hosting.

function Snob (dir) {
  this.dir = dir
  this.repo = new Repo()
}

Snob.prototype = {
  read: function (file, ready) {
    fs.readFile(join(this.dir, file), 'utf-8', ready)
  },
  load: function (callback) {
    var repo = this.repo, self = this
    var n = 2, err
    function ready (e) {
      err = err || e 
      if(--n) return
      callback(err)
    }

    fs.readFile(join(this.dir, '.snob', 'commits'), 'utf-8',
    function (err, commits) {
      commits.split('\n').map(function (e) {
        if(!e) return
        var commit = JSON.parse(e)
        repo.commits[commit.id] = commit
      })
      ready(err)
    })

    fs.readFile(join(this.dir, '.snob', 'state'), 'utf-8',
    function (err, data) {
      var state = JSON.parse(data)
      repo.branches = state.branches || {}
      repo.tags = state.tags || {}
      self.current = state.current 
      ready(err)
    })
  },
  save: function (commit, callback) {
    var n = 2, err
    if(!callback) callback = commit, commit = null

    function ready (e) {
      err = err || e
      if(!--n) return
      callback(err)
    }

    if(!commit)
      n = 1
    else
      append(join(this.dir, '.snob', 'commits')
        , JSON.stringify(commit) + '\n', ready)

    fs.writeFile(join(this.dir, '.snob', 'state')
      , JSON.stringify({
          branches: this.repo.branches, 
          tags: this.repo.tags,
          current: this.current || 'master' ,
        }), ready)
  },
  readFiles: function (files, callback) {

  var n = files.length 
  var world = {}
  var state = this
  var err

  files.map(function (f) {
    state.read(f, function (err, text) {
      if(err)
        return done(err)
      world[f] = text.split('\n')
      done()
    })
  })

  function done (e, text) {
    err = err || e
    if(--n) return
    callback(err, world)
  }

}

 
}

function append (file, text, callback) {
  var s = fs.createWriteStream(file, {flags: 'a'})
  s.on('end', callback)
  s.on('error', callback)
  s.write(text)
  s.end()
}

function findDir (dir) {
  if(dir === '/')
    throw new Error('is not a SNOB repo')
  dir = dir || process.cwd()
  var dotsnob = join(dir, '.snob')
  try {
    fs.readdirSync(dotsnob)
    return new Snob(dir)
  } catch (err) {
    throw err // currently must use snob from root of repo
    if(err.code === 'ENOENT')
      return findDir(join(dir, '..'))
  }
}

var commands = {
  init: function (dir) {
    dir = dir || process.cwd()
    var dotsnob = join(dir, '.snob')
    try {
      fs.readdirSync(dotsnob) 
    } catch (err) {
      //
      if(err.code === 'ENOENT') {
        // create 
        fs.mkdirSync(dotsnob)
        fs.writeFileSync(join(dotsnob, 'commits'), '')
        fs.writeFileSync(join(dotsnob, 'state'), 
          JSON.stringify({current: 'master'})
        )
      }
    }
  },
  commit: function () {
    var files = [].slice.call(arguments)
    var repo = this.repo
    var state = this
    if(!files.length)
      throw new Error('expected args: files to commit')
    console.log('commiting', files)
    //read each file, and 
    this.readFiles(files, function (err, world) {
      console.log('READ')
      if(err) throw err
      var commit = repo.commit(world, {parent: state.current || 'master'})
      console.log(commit)
      state.save(commit, console.log) 
    }) 
  },
  heads: function () {
    console.log(this.repo.heads())
  },
  branch: function (branch) {
    var onbranch = false
    if(!branch) {
      for(var i in this.repo.branches) {
        var b = this.current == i ? '*' : ''
        console.log(i, b) 
        onbranch = onbranch || b
      }
      if(!onbranch)
        console.log(this.current, '*')
    }
    else {
      this.repo.branch(branch, this.current)
      this.current = branch
      this.save(function () {
        console.log('created branch', branch)
      })
    }
  },
  log: function () {
    
    this.repo.revlist('master') // add changing branch
      .map(function (id) {
      
        var commit = state.repo.get(id)
        console.log(commit.id, commit.parent, new Date(commit.timestamp))
      }) 
  },
  diff: function (commitish1, commitish2) {
    console.log(this.repo.diff(commitish1, commitish2))
  },
  checkout: function (commitish) {
    var n = 0
    var newWorld = this.repo.checkout(commitish)
    var state = this
    var hasConflicts = []
    for(var name in newWorld) {
      file = newWorld[name].map(function(e) {
        if('object' !== typeof e)
          return e
        hasConflicts.push(name)
        var conflicts = e['?'].map(function (e) {
          return e.join('\n')
        })
        return         '<<<<<<<<<<<<<<<<<\n' +
        conflicts.join('\n=================\n') +
                       '\n>>>>>>>>>>>>>>>>>'
      }).join('\n') 
      n ++
      fs.writeFile(name, file, 'utf-8', done)
    }

    function done (err) {
      if(err) throw err
      if(--n) return
      console.log('checked out:', commitish)
      state.current = commitish
      if(hasConflicts.length)
        console.log('WARNING: conflicts in', hasConflicts)
      state.save()
    }
  },
  merge: function () {
    var branches = [].slice.call(args)
    if(!args.length)
      throw new Error('expected arg: at least one commitish to merge')
    branches.unshift(this.current)
    console.log('merging', branches)
    var commit = this.repo.merge (branches)
    console.log(commit)
    this.save(commit, function () {
      

    })  
 //   commands.checkout.call(this, commit.id)
  },
  help: function(cmd) {
      var cmds = {
          "init" : "create a repo and persist it",
          "save" : "commits in an append only log save state in a json file just"
            +"needs branches and current checkout commit",
          "commit": "file save the current file in a new commit",
          "checkout": "commitish (commitish = commit/tag/branch)",
          "tag": "name commitish",
          "merge" : "commitish1 commitish2 || current_branch",
          "branch" : "branchname"
      };
      if (cmd) {
          console.log(cmd +" "+ cmds[cmd]);
      } else {
          console.log("Usage:");
          for(var c in cmds) {
              console.log(c +" "+ cmds[c]);
          }
      }
  }
}

var args = optimist.argv._
var cmd = args.shift()
if(cmd == 'init')
  commands.init.apply(null, args)
else if(commands[cmd]) {
  var state = findDir()
  state.load(function (err) {
    if(err) throw err
    commands[cmd].apply(state, args)
  })
} else {
    commands["help"].apply(state,args);
}
