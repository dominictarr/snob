#! /usr/bin/env node

var fs = require('fs')
var join = require('path').join
var Repo = require('./')

// just for a joke, lets add a CLI so that snob can be self hosting.

/*
  COMMANDS

    init // create a repo and persist it.
      save commits in an append only log
      save state in a json file
      just needs branches,
      and current checkout commit
    commit file... save the current file in a new commit
    checkout commitish (commitish = commit/tag/branch)
    tag name commitish
    merge commitish1 commitish2 || current_branch 
    branch branchname
    whereami show current branch

*/

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
      console.log(state)
      ready(err)
    })
  },
  save: function (commit, callback) {
    var n = 2, err
    function ready (e) {
      err = err || e
      if(!--n) return
      callback(err)
    }
    append(join(this.dir, '.snob', 'commits')
      , JSON.stringify(commit) + '\n', ready)

    fs.writeFile(join(this.dir, '.snob', 'state')
      , JSON.stringify({
          branches: this.repo.branches, 
          tags: this.repo.tags,
          current: this.current || 'master' ,
        }), ready)
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
    var state = findDir()
    var files = [].slice.call(arguments)
    var n = files.length + 1// extra one is the repo commits file
    var repo = state.repo
    state.load (done)
    if(!files.length)
      throw new Error('expected args: files to commit')
    console.log(files)
    //read each file, and 
    var world = {}

    files.map(function (f) {
      state.read(f, function (err, text) {
        world[f] = text.split('\n')
        done(err)
      })
    })

    function done (err, text) {
      if(err) throw err
      if(--n) return
      var commit = repo.commit(world, {parent: state.current || 'master'})
      console.log(commit)
      state.save(commit, console.log) 
    }
  },
  heads: function () {
    var state = findDir()
    state.load(function () {
      console.log(state.repo.heads())
    })
  },
  branch: function () {
     var state = findDir()
    state.load(function (err) {
      if(err) throw err
      console.log(state.repo.branches, 'current:', state.current)
    }) 
  },
  log: function () {
    var state = findDir()
    state.load(function () {
      state.repo.revlist('master') // add changing branch
      .map(function (id) {
        
        var commit = state.repo.get(id)
        console.log(commit.id, commit.parent, new Date(commit.timestamp))
      })
    })
  }
}

var args = process.argv
args.splice(0, 2)

console.log(args)
var cmd = args.shift()
if(commands[cmd])
  commands[cmd].apply(null, args)
