var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

if (!process.env) process.env = {};
if (!process.argv) process.argv = [];

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/node_modules/browser-stream/node_modules/browser-stream/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {}
});

require.define("/node_modules/browser-stream/index.js", function (require, module, exports, __dirname, __filename) {

var Stream = require('stream').Stream
var EventEmitter = require('events').EventEmitter

module.exports = function (sock) {
  var e = new EventEmitter ()

  //id use socket.io namespaces here, but they are really arwkward in this usecase.
  function _writeStream (s) {
      var DATA = s.name
      var END = 'END_'+s.name
       s.write = function (data) {
        console.log('DATA',DATA, data)
        sock.emit(DATA, data)
        return true
      }
      s.end = function (data) {
        if(data != null) this.write(data)
        sock.emit(END)
      }
      //sock.on('PAUSE_'+name, ...
      //sock.on('DRAIN_'+name, ... 
  }

  function _readStream (s) {
    var DATA = s.name
      , END = 'END_'+s.name
    s.readable = true
    function onData(data) {
      s.emit('data', data)
    }
    function onEnd () {
      s.emit('end')
      sock.removeListener(DATA, onData)
      sock.removeListener(END, onEnd)
    }
    sock.on(DATA, onData)
    sock.on(END, onEnd) 
  }

  function _createStream(opts) {
    var s = new Stream()
    //if either w or r is false, def will be false
    var def = !opts.writable && !opts.readable 
    s.readable = opts.readable || def
    s.writable = opts.writable || def
    console.log('CREATE_STREAM', opts, s)
    s.name = opts.name
    if(s.writable)
      _writeStream(s)
    if(s.readable)
      _readStream(s)
    return s
  }

  e.createWriteStream = function (name) {
    return this.createStream(name, {writable: true})
  }
 
  e.createReadStream = function (name) {
    return this.createStream(name, {readable: true})
  }

  e.createStream = function (name, opts) {
    if(!opts) opts = ('string' === typeof name ? {name: name} : name)
    name = opts.name
    var _opts = {name: name}
    var s = _createStream(opts) //defaults to readable and writable 
    if(s.readable)
      _opts.writable = true
    if(s.writable)
      _opts.readable = true
    console.log('OPTS', _opts)
    sock.emit('CREATE_STREAM', _opts, s)
    return s
  }
  
  sock.on('CREATE_STREAM', function (opts) {
    console.log('CREATE_STREAM', opts)
    var s = _createStream(opts)
    e.emit('connection', s)
    e.emit('open', s) //legacy interface
  })

  return e
} 

});

require.define("stream", function (require, module, exports, __dirname, __filename) {
var events = require('events');
var util = require('util');

function Stream() {
  events.EventEmitter.call(this);
}
util.inherits(Stream, events.EventEmitter);
module.exports = Stream;
// Backwards-compat with node 0.4.x
Stream.Stream = Stream;

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once, and
  // only when all sources have ended.
  if (!dest._isStdio && (!options || options.end !== false)) {
    dest._pipeCount = dest._pipeCount || 0;
    dest._pipeCount++;

    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (this.listeners('error').length === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('end', cleanup);
    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('end', cleanup);
  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

});

require.define("events", function (require, module, exports, __dirname, __filename) {
if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = list.indexOf(listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("util", function (require, module, exports, __dirname, __filename) {
var events = require('events');

exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

});

require.define("/node_modules/snob/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {"main":"./index.js"}
});

require.define("/node_modules/snob/docuset.js", function (require, module, exports, __dirname, __filename) {

var u = require('./utils')
var es = require('event-stream')
var EventEmitter = require('events').EventEmitter

/*
  need to inject the difftools, and validate functions here.

  inject a createRepo that takes the name, and can setup different Repo types,
  with different validation, diffutils, and merge rules.
*/

var Repo = require('./')

var _createRepo = function () {
  return new Repo()
} 

//should probably require that the first message is
// ['AUTH', credentials]
function Docuset (opts) {
  if(!(this instanceof Docuset)) return new Docuset(opts)
  opts = opts || {}
  var createRepo = opts.createRepo || _createRepo
  var repos = this.repos = {}
  var self = this
  this.id = opts.id || '#' + Math.random()
  //could also make this create a stream instance
  this.createRepo = function (key) {
    if(repos[key])
      return repos[key]
    repos[key] = createRepo(key)
    this.emit('new', repos[key])
    return repos[key] 
  }
  this.createRawHandler = function (onConnect) {
    return function (ins, outs) {
      if(!outs)
        outs = ins
      console.error('OUT', outs)
      console.error('INS', ins)
      if(!outs.writable)
        throw new Error('out stream must be writeable')
       if(!ins.readable)
        throw new Error('in stream must be writeable')
      //listen to repo for updates!
      var remotes = {}
      var listeners = {}
      var queue = []
      function flush () {
        while(queue.length)
          queue.shift()()
      }
      function createIf(key, id) {
        remotes[key] = remotes[key] || {}
        if(repos[key]) return
        //need injectable configuration per repo ...
        //like whether to accept non ff, and what diffutils to use.
        self.emit('new', repos[key] = createRepo(key))
      }

      function track(key) {
        createIf(key)
        var branches = repos[key].branches
        var r = repos[key]
        //remotes[key] = u.extend(remotes[key], branches)
        if(listeners[key]) return
   
        listeners[key] = function (revs, branch) { //change order so consistant
          //need to queue this, and set a nextTick to flush the queue.
          //am queuing updates, because want to return
          // from processing an update, before I think about 
          //sending anything back to another connection.
          queue.push(function () {
            var head = r.branch(branch)
            var revs = r.getRevs(branch, remotes[key][branch]) 
            if(revs.length) { 
              outs.write(['UPDATE', key, branch, revs ]) 
              remotes[key][branch] = revs[revs.length - 1].id
            }
          })
          process.nextTick(flush)
        }
        //for each branch in the repo, bring the listener up to date.
        // NICEN this, just exec this whenever an update flushes.
        u.map(repos[key].branches, function (commit, branch) {
          //this breaks when a second repo connects.
          if(!remotes[key] || commit != remotes[key][branch]) {
            var revs = repos[key].getRevs(branch, remotes[key][branch])
            if(revs.length) {
              outs.write(['UPDATE', key, branch, revs])
              remotes[key][branch] = revs[revs.length - 1].id
            }
          }
        }) 

        repos[key].on('update', listeners[key])
        //THEY ARE PROBABLY NOT UP TO DATE.
      }
      var reciever = {
        sub: function (key, branches) {
          track(key, branches)
          return repos[key]
        },
        unsub: function (key) {
          repos[key].removeListener('update', listeners[key])
        },
        //do not call update directly, make a commit to the repo!
        update: function (key, branch, revs) {
          createIf(key)
          //update is an implicit sub.
          var id = repos[key].recieve(revs, branch, true) //??
          //since repo emits the update syncronously,
          //it sends before it updates the id
          remotes[key][branch] = id
          if(!listeners[key]) connection.sub(key)
          if(queue.length) flush()
        }
      }
      var connection = {
        sub: function (key) {
          track(key)
          outs.write(['SUB', key, repos[key].branches])
          return repos[key]
        },
        unsub: function (key) {
          outs.write(['UNSUB', key])
        }
      }
      ins.pipe(es.map(function (data) {
        var type = data[0]
        ;(reciever)[type.toLowerCase()].apply(null, data.slice(1))
      }))
 
      if(onConnect) onConnect(connection)
      self.emit('connection', connection)
      return connection
    }
  }

  this.createHandler = function (onConnect) {
    var handler = self.createRawHandler(onConnect)
    return function (ins, outs) {
      outs = outs || ins
      var stringify = es.stringify()
      stringify.pipe(es.log()).pipe(outs)
      return handler(
        ins.pipe(es.split()).pipe(es.parse()),
        stringify
      )
    }
  }

  this.handler = this.createHandler() 
}

Docuset.prototype = new EventEmitter()

/*
  add this from somewhere else so that I can use this from the browser 
  with socket.io instead.

*/

Docuset.prototype.createServer = function (server, onConnect) {
  // TODO: support different server types, http, socket.io
  // maybe subclasses would be a good way to do this?
  if('function' === typeof server)
    onConnect = server, server = null
  var handler = this.createHandler(onConnect)
  if(server instanceof EventEmitter) {
    //assume that a server has been passed in
    this._server = server
    server.on('connection', handler)
  } else {
    // (require)() is a trick so that browserify will not bundle.
    var net = (require)('net')
    this._server = net.createServer(handler)
  }
    
  function proxy (e, _e, event) {
    e.on(event, function () {
      var args = [].slice.call(arguments)
      args.unshift(event)
      _e.emit.apply(_e, args)
    }) 
  }
  proxy(this, this._server, 'new')
  //proxy(this, this._server, 'connection')
  //RENAME THE CONNECTION EVENT. that name is special

 return this._server
}

Docuset.prototype.createConnection = 
Docuset.prototype.connect = function () {
  var args = [].slice.call(arguments)
  var soc = net.createConnection.apply(null, args)
  var con = this.createHandler()(soc)

  con._socket = soc
  return con
}

module.exports = Docuset


});

require.define("/node_modules/snob/utils.js", function (require, module, exports, __dirname, __filename) {

exports.extend = function (a, b) {
    // copy b onto a
    for (var k in b)
      a[k] = b[k]
    return a
  }
exports.map = function (obj, itr) {
    var r = {}
    for (var i in obj)
      r[i] = itr(obj[i], i, obj)
    return r
  }

exports.copy = function (obj) {
    return exports.map(obj, function(e) {return e})
  }

exports.keys = function (obj) {
    var ks = []
    for (var k in obj)
      ks.push(k)
    return ks
  }
  
exports.max = function (ary, iter) {
    var M = null
    for(var k in ary) {
      var m = iter(ary[k],k,ary)
      if(M === null || m > M)
        M = m
    }
    return M
  }


});

require.define("/node_modules/snob/node_modules/event-stream/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {}
});

require.define("/node_modules/snob/node_modules/event-stream/index.js", function (require, module, exports, __dirname, __filename) {
//filter will reemit the data if cb(err,pass) pass is truthy
// reduce is more tricky
// maybe we want to group the reductions or emit progress updates occasionally
// the most basic reduce just emits one 'data' event after it has recieved 'end'


var Stream = require('stream').Stream
  , es = exports

es.Stream = Stream //re-export Stream from core

// through
//
// a stream that does nothing but re-emit the input.
// useful for aggregating a series of changing but not ending streams into one stream)

es.through = function () {
  var stream = new Stream()
  stream.readable = stream.writable = true
  
  stream.write = function (data) {
    stream.emit('data', data)
  }
  stream.end = function (data) {
    if(data)
      stream.emit('data',data)
    stream.emit('end')
  }
  return stream
}

// buffered
//
// same as a through stream, but won't emit a chunk until the next tick.
// does not support any pausing. intended for testing purposes.

es.asyncThrough = function () {
  var stream = new Stream()
  var queue = []
  var ended = false
  stream.readable = stream.writable = true
  stream.flush = function () {
    while(queue.length)
      stream.emit('data', queue.shift())  
    if(ended) stream.emit('end')
  }
  stream.write = function (data) {
    if(ended) return
    if(!queue.length)
      process.nextTick(stream.flush)
    queue.push(data)
    return true
  }
  stream.end = function (data) {
    if(data) stream.write(data)
    ended = true
    if(!queue.length)
      stream.emit('end')
  }
  return stream
}


// writable stream, collects all events into an array 
// and calls back when 'end' occurs
// mainly I'm using this to test the other functions

es.writeArray = function (done) {
  if ('function' !== typeof done)
    throw new Error('function writeArray (done): done must be function')

  var a = new Stream ()
    , array = []
  a.write = function (l) {
    array.push(l)
  }
  a.end = function () {
    done(null, array)
  }
  a.writable = true
  a.readable = false
  return a
}

//return a Stream that reads the properties of an object
//respecting pause() and resume()

es.readArray = function (array) {
  var stream = new Stream()
    , i = 0
    , paused = false
 
  stream.readable = true  
  stream.writable = false
 
  if(!Array.isArray(array))
    throw new Error('event-stream.read expects an array')
  
  stream.resume = function () {
    paused = false
    var l = array.length
    while(i < l && !paused) {
      stream.emit('data', array[i++])
    }
    if(i == l)
      stream.emit('end'), stream.readible = false
  }
  process.nextTick(stream.resume)
  stream.pause = function () {
     paused = true
  }
  return stream
}

//
// readable (asyncFunction)
// return a stream that calls an async function while the stream is not paused.
//
// the function must take: (count, callback) {...
//
es.readable = function (func, continueOnError) {
  var stream = new Stream()
    , i = 0
    , paused = false
    , ended = false
    , reading = false

  stream.readable = true  
  stream.writable = false
 
  if('function' !== typeof func)
    throw new Error('event-stream.readable expects async function')
  
  stream.on('end', function () { ended = true })
  
  function get (err, data) {
    
    if(err) {
      stream.emit('error', err)
      if(!continueOnError) stream.emit('end')
    } else if (arguments.length > 1)
      stream.emit('data', data)

    process.nextTick(function () {
      if(ended || paused || reading) return
      try {
        reading = true
        func.call(stream, i++, function () {
          reading = false
          get.apply(null, arguments)
        })
      } catch (err) {
        stream.emit('error', err)    
      }
    })
  
  }
  stream.resume = function () {
    paused = false
    get()
  }
  process.nextTick(get)
  stream.pause = function () {
     paused = true
  }
  return stream
}


//create an event stream and apply function to each .write
//emitting each response as data
//unless it's an empty callback

es.map = function (mapper) {
  var stream = new Stream()
    , inputs = 0
    , outputs = 0
    , ended = false
    , paused = false
  stream.writable = true
  stream.readable = true
   
  stream.write = function () {
    inputs ++
    var args = [].slice.call(arguments)
      , r
      , inNext = false 
    //pipe only allows one argument. so, do not 
    function next (err) {
      inNext = true
      outputs ++
      var args = [].slice.call(arguments)
      if(err) {
        args.unshift('error')
        return inNext = false, stream.emit.apply(stream, args)
      }
      args.shift() //drop err
      if (args.length){
        args.unshift('data')
        r = stream.emit.apply(stream, args)
      }
      if(inputs == outputs) {
        if(paused) paused = false, stream.emit('drain') //written all the incoming events
        if(ended)
          stream.end()
      }
      inNext = false
    }
    args.push(next)
    
    try {
      //catch sync errors and handle them like async errors
      var written = mapper.apply(null,args)
      if(written === false) paused = true
      return written
    } catch (err) {
      //if the callback has been called syncronously, and the error
      //has occured in an listener, throw it again.
      if(inNext)
        throw err
      next(err)
      return true
    }
  }

  stream.end = function () {
    var args = [].slice.call(arguments)
    //if end was called with args, write it, 
    ended = true //write will emit 'end' if ended is true
    if(args.length)
      return stream.write.apply(emitter, args)
    else if (inputs == outputs) //wait for processing
      stream.emit('end')
  }

  return stream
}

//
// map sync
//

es.mapSync = function (sync) {
  
  return es.map(function () {
    var args = [].slice.call(arguments)
      , callback = args.pop()
      
      callback(null, sync.apply(null, args))
  })
}

//
// log just print out what is coming through the stream, for debugging
//

es.log = function (name) {
  return es.map(function () {
    var args = [].slice.call(arguments)
    var cb = args.pop()
    console.error.apply(console, name ? [name].concat(args) : args)
    args.unshift(null)
    cb.apply(null, args)
  })
}

//
// combine multiple streams together so that they act as a single stream
//

es.pipe = es.connect = function () {

  var streams = [].slice.call(arguments)
    , first = streams[0]
    , last = streams[streams.length - 1]
    , thepipe = es.duplex(first, last)

  if(streams.length == 1)
    return streams[0]
  else if (!streams.length)
    throw new Error('connect called with empty args')

  //pipe all the streams together

  function recurse (streams) {
    if(streams.length < 2)
      return
    streams[0].pipe(streams[1])
    recurse(streams.slice(1))  
  }
  
  recurse(streams)
 
  function onerror () {
    var args = [].slice.call(arguments)
    args.unshift('error')
    thepipe.emit.apply(thepipe, args)
  }
  
  streams.forEach(function (stream) {
    stream.on('error', onerror)
  })

  return thepipe
}

//
// child -- pipe through a child process
//

es.child = function (child) {

  return es.duplex(child.stdin, child.stdout)

}

//
// duplex -- pipe into one stream and out another
//

es.duplex = function (writer, reader) {
  var thepipe = new Stream()

  thepipe.__defineGetter__('writable', function () { return writer.writable })
  thepipe.__defineGetter__('readable', function () { return reader.readable })

  ;['write', 'end', 'close'].forEach(function (func) {
    thepipe[func] = function () {
      return writer[func].apply(writer, arguments)
    }
  })

  ;['resume', 'pause'].forEach(function (func) {
    thepipe[func] = function () { 
      thepipe.emit(func)
      if(reader[func])
        return reader[func].apply(reader, arguments)
      else
        reader.emit(func)
    }
  })

  ;['data', 'close'].forEach(function (event) {
    reader.on(event, function () {
      var args = [].slice.call(arguments)
      args.unshift(event)
      thepipe.emit.apply(thepipe, args)
    })
  })
  //only emit end once
  var ended = false
  reader.on('end', function () {
    if(ended) return
    ended = true
    var args = [].slice.call(arguments)
    args.unshift('end')
    thepipe.emit.apply(thepipe, args)
  })

  return thepipe
}

es.split = function (matcher) {
  var stream = new Stream()
    , soFar = ''  
  
  if (!matcher)
      matcher = '\n'

  stream.writable = true
  stream.readable = true;  //necessary for reading more than one data event
  stream.write = function (buffer) {
    buffer = buffer.toString()
    var l = buffer.length
      , i = 0
    while (i < l) {
      var c = buffer[i].toString()
      soFar += c
      if (c == matcher) {
        var n = soFar;
        soFar = '' 
        this.emit('data', n)
      }
    i++
    }
    return true;
  }

  stream.end = function () {
    if(soFar)
      stream.emit('data', soFar)  
    stream.emit('end')
  }

  return stream
}

//
// gate 
//
// while the gate is shut(), buffer incoming. 
// 
// if gate is open() stream like normal.
//
// currently, when opened, this will emit all data unless it is shut again
// if downstream pauses it will still write, i'd like to make it respect pause, 
// but i'll need a test case first.

es.gate = function (shut) {

  var stream = new Stream()
    , queue = []
    , ended = false

    shut = (shut === false ? false : true) //default to shut

  stream.writable = true
  stream.readable = true

  stream.isShut = function () { return shut }
  stream.shut   = function () { shut = true }
  stream.open   = function () { shut = false; maybe() }
  
  function maybe () {
    while(queue.length && !shut) {
      var args = queue.shift()
      args.unshift('data')
      stream.emit.apply(stream, args)
    }
    stream.emit('drain')
    if(ended && !shut) 
      stream.emit('end')
  }
  
  stream.write = function () {
    var args = [].slice.call(arguments)
  
    queue.push(args)
    if (shut) return //false //pause up stream pipes  

    maybe()
  }

  stream.end = function () {
    ended = true
    if (!queue.length)
      stream.emit('end')
  }

  return stream
}

//
// parse
//

es.parse = function () { 
  return es.mapSync(function (e){
    return JSON.parse(e.toString())
  }) 
}
//
// stringify
//

es.stringify = function () { 
  return es.mapSync(function (e){
    return JSON.stringify(e) + '\n'
  }) 
}

//
// replace a string within a stream.
//
// warn: just concatenates the string and then does str.split().join(). 
// probably not optimal.
// for smallish responses, who cares?
// I need this for shadow-npm so it's only relatively small json files.

es.replace = function (from, to) {
  var stream = new Stream()
  var body = ''
  stream.readable = true
  stream.writable = true
  stream.write = function (data) { body += data; return true }
  stream.end = function (data) {
    if(data)
      body += data
    if(body) stream.emit('data', body.split(from).join(to))
    stream.emit('end')
  }
  return stream
} 

es.join = function (callback) {
  var stream = new Stream()
  var body = ''
  stream.readable = true
  stream.writable = true
  stream.write = function (data) { body += data }
  stream.end = function (data) {
    if(data)
      body += data
    if(callback)
      callback(null, body)
    stream.emit('data', body)
    stream.emit('end')
  }
  return stream
}

//
// helper to make your module into a unix pipe
// simply add 
// 
// if(!module.parent)
//  require('event-stream').pipable(asyncFunctionOrStreams)
// 
// asyncFunctionOrStreams may be one or more Streams or if it is a function, 
// it will be automatically wrapped in es.map
//
// then pipe stuff into from the command line!
// 
// curl registry.npmjs.org/event-stream | node hello-pipeable.js | grep whatever
//
// etc!
//
// also, start pipeable running as a server!
//
// > node hello-pipeable.js --port 44444
// 

var setup = function (args) {
  return args.map(function (f) {
    var x = f()
      if('function' === typeof x)
        return es.map(x)
      return x
    })
}

es.pipeable = function () {
  if(process.title != 'node')
    return console.error('cannot use es.pipeable in the browser')
  //(require) inside brackets to fool browserify, because this does not make sense in the browser.
  var opts = (require)('optimist').argv
  var args = [].slice.call(arguments)
  
  if(opts.h || opts.help) {
    var name = process.argv[1]
    console.error([
      'Usage:',
      '',
      'node ' + name + ' [options]',
      '  --port PORT        turn this stream into a server',
      '  --host HOST        host of server (localhost is default)',
      '  --protocol         protocol http|net will require(protocol).createServer(...',
      '  --help             display this message',
      '',
      ' if --port is not set, will stream input from stdin',
      '',
      'also, pipe from or to files:',
      '',
      ' node '+name+ ' < file    #pipe from file into this stream',
      ' node '+name+ ' < infile > outfile    #pipe from file into this stream',     
      '',
    ].join('\n'))
  
  } else if (!opts.port) {
    var streams = setup(args)
    streams.unshift(es.split())
    //streams.unshift()
    streams.push(process.stdout)
    var c = es.connect.apply(null, streams)
    process.openStdin().pipe(c) //there
    return c

  } else {
  
    opts.host = opts.host || 'localhost'
    opts.protocol = opts.protocol || 'http'
    
    var protocol = (require)(opts.protocol)
        
    var server = protocol.createServer(function (instream, outstream) {  
      var streams = setup(args)
      streams.unshift(es.split())
      streams.unshift(instream)
      streams.push(outstream || instream)
      es.pipe.apply(null, streams)
    })
    
    server.listen(opts.port, opts.host)

    console.error(process.argv[1] +' is listening for "' + opts.protocol + '" on ' + opts.host + ':' + opts.port)  
  }
}

});

require.define("/node_modules/snob/index.js", function (require, module, exports, __dirname, __filename) {

/*
  dependency injection for the server side.

*/

var a = require('xdiff')

var createHash = require('crypto').createHash 
function hash (obj) {
  return createHash('sha1').update(JSON.stringify(obj)).digest('hex')
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

});

require.define("/node_modules/snob/node_modules/xdiff/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {}
});

require.define("/node_modules/snob/node_modules/xdiff/index.js", function (require, module, exports, __dirname, __filename) {

//inject a matchRef, isRef, and a getRef function?
//could use the same pattern with objects.

//I don't really want to force __id__
//should be able to use anything, aslong as you 


function shallowEqual (a, b) {
    if(isObject(a) 
      && isObject(b) 
      && (a.__id__ == b.__id__ || a === b))
      return true
    if(a && !b) return false
    return a == b
  }


function equal (a, b) {
 if((a && !b) || (!a && b)) return false
  if(Array.isArray(a))
    if(a.length != b.length) return false
  if(isObject(a) && isObject(b)) {
    if (a.__id__ == b.__id__ || a === b)
      return true
    for(var i in a)
      if(!equal(a[i], b[i])) return false
    return true
  }
  if(a == null && b == null) return true
  return a === b
}

var adiff = require('adiff')({ equal: equal })

function getPath (obj, path) {
  if(!Array.isArray(path))
    return obj[path]
  for(var i in path) {
    obj = obj[path[i]]
  }
  return obj
}

function findRefs(obj, refs) {
  refs = refs || {}
  //add leaves before branches.
  //this will FAIL if there are circular references.

  if(!obj)
    return refs

  for(var k in obj) {
    if(obj[k] && 'object' == typeof obj[k])
      findRefs(obj[k], refs)
  }
  
  if(obj.__id__ && !refs[obj.__id__])
    refs[obj.__id__] = obj
  return refs
}

function toRef(v) {
  //TODO escape strings that happen to start with #*=
  var r
  if(r = isRef(v)) return '#*='+r
  return v
}

function isObject (o) {
  return o && 'object' == typeof o
}

function isRef(x) {
  return x ? x.__id__ : undefined
}

function sameRef(a, b) {
  return a && b && isRef(a) == isRef(b)
}

//traverse o, and replace every object with __id__ with a pointer.
//make diffing references easy.


exports.deref = function (o, mutate) {
  var refs = findRefs(o)
  var derefed = {}
  function deref (o, K) {
    if(isRef(o) && K != isRef(o))
      return toRef(o)
 
    var p = mutate ? o : Array.isArray(o) ? [] : {} //will copy the tree!
    for (var k in o) {
      var r 
      if(isRef(o[k])) p[k] = toRef(o[k])
      else if(isObject(o[k])) p[k] = deref(o[k])
      else p[k] = o[k]
    }
    return p
  }
  
  refs.root = o
  for (var k in refs)
    refs[k] = deref(refs[k], k)
  return refs
}

exports.reref = function (refs, mutate) {

  function fromRef(v) {
    //TODO escape strings that happen to start with #*=
    if('string' == typeof v && /^#\*=/.test(v)) return refs[v.substring(3)]
      return v
  }

  function reref (o) { //will MUTATE the tree
    if(!isObject(o))
      return fromRef(o)

    var p = mutate ? o : Array.isArray(o) ? [] : {} //will copy the tree!
    for (var k in o) {
      if(isObject(o[k]))
         p[k] = reref(o[k])
      else
        p[k] = fromRef(o[k])
    }
    return p
  }
  //if the root is a ref. need a special case
  for (var k in refs) {
    refs[k] = reref(refs[k])
  }
  return refs.root
}

exports.diff = function (a, b) {

  var aRefs = exports.deref(a)
  var bRefs = exports.deref(b)

  var seen = []

  for (var k in aRefs)
    seen.push(k)

 function isSeen(o) {
    if(isRef(o)) return ~seen.indexOf(o.__id__)
    return true 
  }
  function addSeen(o) {
    if(!isRef(o)) return o
    if(!isSeen(o)) seen.push(o.__id__)
    return o
  }

  // how to handle references?
  // this is necessary to handle objects in arrays nicely
  // otherwise mergeing an edit and a move is ambigous.  // will need to perform a topoligical sort of the refs and diff them first, in that order.
  // first, apply changes to all refs,
  // then traverse over the root object,

  function _diff (a, b, path) {
    path = path || []

    if(Array.isArray(a) && Array.isArray(b)) {
      var d = adiff.diff(a, b)
      if(d.length) delta.push(['splice', path, d])
      return delta
    }

// references to objects with ids are
// changed into strings of thier id.
// the string is prepended with '#*='
// to distinguish it from other strings
// if you use that string in your model,
// it will break.
// TODO escape strings so this is safe

   //ah, treat root like it's a __id__

   var isRoot = path.length === 1 && path[0] === 'root'

    for (var k in b) {
      // if both are nonRef objects, or are the same object, branch into them.
    
    if(isObject(a[k]) && isObject(b[k]) && sameRef(b[k], a[k])) 
      _diff(a[k], b[k], path.concat(k))
    else if(b[k] !== a[k])
      delta.push(['set', path.concat(k), cpy(b[k])])
    }
    
    for (var k in a)
      if('undefined' == typeof b[k])
        delta.push(['del', path.concat(k)])
  }

  var delta = []
  _diff(aRefs, bRefs, [])

  if(delta.length)
    return cpy(delta)
}

exports.patch = function (a, patch) {

  if(!patch) throw new Error('expected patch')

  var refs = exports.deref(a, true)
  refs.root = a

  var methods = {
    set: function (key, value) {
      this[key] = cpy(value) // incase this was a reference, remove it.
    },
    del: function (key) {
      delete this[key]
    },
    splice: function (changes) {
      adiff.patch(this, changes, true)
    }
  }

  function pathTo(a, p) {
    for (var i in p) a = a[p[i]]
    return a
  }

  patch.forEach(function (args) {
    args = args.slice()
    var method = args.shift()
    var path = args.shift().slice()
    var key
    if(method != 'splice') {
      key = path.pop()
      args.unshift(key)
    }
    var obj = pathTo(refs, path)
    methods[method].apply(obj, args)
  })

  return exports.reref(refs, true)
}

function cpy(o) {
  if(!o) return o
  return JSON.parse(JSON.stringify(o))
}

exports.diff3 = function (a, o, b) {
  if(arguments.length == 1)
    o = a[1], b = a[2], a = a[0]
  var _a = exports.diff(o, a) || [] // if there where no changes, still merge
    , _b = exports.diff(o, b) || []

  function cmp (a, b) {
    //check if a[1] > b[1]
    if(!b)
      return 1

    var p = a[1], q = b[1]
    var i = 0
    while (p[i] === q[i] && p[i] != null)
      i++

    if(p[i] === q[i]) return 0
    return p[i] < q[i] ? -1 : 1
  }

  function isPrefix(a, b) {
    if(!b) return 1
    var p = a[1], q = b[1]
    var i = 0
    while (p[i] === q[i] && i < p.length && i < q.length)
      i++
    if(i == p.length || i == q.length) return 0
    return p[i] < q[i] ? -1 : 1 
  }

  //merge two lists, which must be sorted.

  function cmpSp (a, b) {
    if(a[0] == b[0])
      return 0
    function max(k) {
      return k[0] + (k[1] >= 1 ? k[1] - 1 : 0)
    }
    if(max(a) < b[0] || max(b) < a[0])
      return a[0] - b[0]
    return 0
  }

  function resolveAry(a, b) {
    return a
  }

  function resolve(a, b) {
    if(a[1].length == b[1].length) { 
      if(a[0] == b[0]) {
        if(a[0] == 'splice') {
          var R = merge(a[2], b[2], cmpSp, resolveAry)
          return ['splice', a[1].slice(), R]
        } else if(equal(a[2], b[2])) //same change both sides.
          return a
      }
    }
    return a
  }

  function merge(a, b, cmp, resolve) {
    var i = a.length - 1, j = b.length - 1, r = []
    while(~i && ~j) {
      var c = cmp(a[i], b[j])
      if(c > 0) r.push(a[i--])
      if(c < 0) r.push(b[j--])
      if(!c) {
        var R = resolve(a[i], b[j])
          j--, i--
        r.push(R)
      }
    }
    //finish off the list if there are any left over
    while(~i) r.push(a[i--])
    while(~j) r.push(b[j--])
    return r
  }

  _a.sort(cmp)
  _b.sort(cmp)

  var m = merge(_a, _b, isPrefix, resolve)
  return m.length ? m : null
}

});

require.define("/node_modules/snob/node_modules/xdiff/node_modules/adiff/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {"main":"./index.js"}
});

require.define("/node_modules/snob/node_modules/xdiff/node_modules/adiff/index.js", function (require, module, exports, __dirname, __filename) {
function head (a) {
  return a[0]
}

function last (a) {
  return a[a.length - 1]
}

function tail(a) {
  return a.slice(1)
}

function retreat (e) {
  return e.pop()
}

function hasLength (e) {
  return e.length
}

function any(ary, test) {
  for(var i in ary)
    if(test(ary[i]))
      return true
  return false
}

var _rules // set at the bottom  

// note, naive implementation. will break on circular objects.

function _equal(a, b) {
  if(a && !b) return false
  if(Array.isArray(a))
    if(a.length != b.length) return false
  if(a && 'object' == typeof a) {
    for(var i in a)
      if(!_equal(a[i], b[i])) return false
    return true
  }
  return a == b
}

function getArgs(args) {
  return args.length == 1 ? args[0] : [].slice.call(args)
}

// return the index of the element not like the others, or -1
function oddElement(ary, cmp) {
  var c
  function guess(a) {
    var odd = -1
    c = 0
    for (var i = a; i < ary.length; i ++) {
      if(!cmp(ary[a], ary[i])) {
        odd = i, c++
      }
    }
    return c > 1 ? -1 : odd
  }
  //assume that it is the first element.
  var g = guess(0)
  if(-1 != g) return g
  //0 was the odd one, then all the other elements are equal
  //else there more than one different element
  guess(1)
  return c == 0 ? 0 : -1
}
var exports = module.exports = function (deps, exports) {
  var equal = (deps && deps.equal) || _equal
  exports = exports || {} 
  exports.lcs = 
  function lcs() {
    var cache = {}
    var args = getArgs(arguments)
   
    function key (a,b){
      return a.length + ':' + b.length
    }

    function recurse (a, b) {
      if(!a.length || !b.length) return []
      //avoid exponential time by caching the results
      if(cache[key(a, b)]) return cache[key(a, b)]

      if(equal(a[0], b[0]))
        return [head(a)].concat(recurse(tail(a), tail(b)))
      else { 
        var _a = recurse(tail(a), b)
        var _b = recurse(a, tail(b))
        return cache[key(a,b)] = _a.length > _b.length ? _a : _b  
      }
    }

    if(args.length > 2) {
      //if called with multiple sequences
      //recurse, since lcs(a, b, c, d) == lcs(lcs(a,b), lcs(c,d))
      args.push(lcs(args.shift(), args.shift()))
      return lcs(args)
    }
    return recurse(args[0], args[1])
  }

  // given n sequences, calc the lcs, and then chunk strings into stable and unstable sections.
  // unstable chunks are passed to build
  exports.chunk =
  function (q, build) {
    var q = q.map(function (e) { return e.slice() })
    var lcs = exports.lcs.apply(null, q)
    var all = [lcs].concat(q)

    function matchLcs (e) {
      if(e.length && !lcs.length || !e.length && lcs.length)
        return false //incase the last item is null 
      return equal(last(e), last(lcs)) || ((e.length + lcs.length) === 0)
    }

    while(any(q, hasLength)) {
      //if each element is at the lcs then this chunk is stable.
      while(q.every(matchLcs) && q.every(hasLength)) 
        all.forEach(retreat) 

      //collect the changes in each array upto the next match with the lcs
      var c = false
      var unstable = q.map(function (e) {
        var change = []
        while(!matchLcs(e)) {
          change.unshift(retreat(e))
          c = true
        }
        return change
      })
      if(c) build(q[0].length, unstable)
    }
  }

  exports.diff =
  function (a, b) {
    var changes = []
    exports.chunk([a, b], function (index, unstable) {
      var del = unstable.shift().length
      var insert = unstable.shift()
      changes.push([index, del].concat(insert))
    })
    return changes
  }

  exports.patch = function (a, changes, mutate) {
    if(mutate !== true) a = a.slice(a)//copy a
    changes.forEach(function (change) {
      [].splice.apply(a, change)
    })
    return a
  }

  // http://en.wikipedia.org/wiki/Concestor
  // me, concestor, you...
  exports.merge = function () {
    var args = getArgs(arguments)
    var patch = exports.diff3(args)
    return exports.patch(args[0], patch)
  }

  exports.diff3 = function () {
    var args = getArgs(arguments)
    var r = []
    exports.chunk(args, function (index, unstable) {
      var mine = unstable[0]
      var insert = resolve(unstable)
      if(equal(mine, insert)) return 
      r.push([index, mine.length].concat(insert)) 
    })
    return r
  }
  exports.oddOneOut =
    function oddOneOut (changes) {
      changes = changes.slice()
      //put the concestor first
      changes.unshift(changes.splice(1,1)[0])
      var i = oddElement(changes, equal)
      if(i == 0) // concestor was different, 'false conflict'
        return changes[1]
      if (~i)
        return changes[i] 
    }
  exports.insertMergeOverDelete = 
    //i've implemented this as a seperate rule,
    //because I had second thoughts about this.
    function insertMergeOverDelete (changes) {
      changes = changes.slice()
      changes.splice(1,1)// remove concestor
      
      //if there is only one non empty change thats okay.
      //else full confilct
      for (var i = 0, nonempty; i < changes.length; i++)
        if(changes[i].length) 
          if(!nonempty) nonempty = changes[i]
          else return // full conflict
      return nonempty
    }

  var rules = (deps && deps.rules) || [exports.oddOneOut, exports.insertMergeOverDelete]

  function resolve (changes) {
    var l = rules.length
    for (var i in rules) { // first
      
      var c = rules[i] && rules[i](changes)
      if(c) return c
    }
    changes.splice(1,1) // remove concestor
    //returning the conflicts as an object is a really bad idea,
    // because == will not detect they are the same. and conflicts build.
    // better to use
    // '<<<<<<<<<<<<<'
    // of course, i wrote this before i started on snob, so i didn't know that then.
    /*var conflict = ['>>>>>>>>>>>>>>>>']
    while(changes.length)
      conflict = conflict.concat(changes.shift()).concat('============')
    conflict.pop()
    conflict.push          ('<<<<<<<<<<<<<<<')
    changes.unshift       ('>>>>>>>>>>>>>>>')
    return conflict*/
    //nah, better is just to use an equal can handle objects
    return {'?': changes}
  }
  return exports
}
exports(null, exports)

});

require.define("crypto", function (require, module, exports, __dirname, __filename) {
module.exports = require("crypto-browserify")
});

require.define("/node_modules/crypto-browserify/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {}
});

require.define("/node_modules/crypto-browserify/index.js", function (require, module, exports, __dirname, __filename) {
var sha = require('./sha')

var algorithms = {
  sha1: {
    hex: sha.hex_sha1,
    binary: sha.b64_sha1,
    ascii: sha.str_sha1
  }
}

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = function (alg) {
  alg = alg || 'sha1'
  if(!algorithms[alg])
    error('algorithm:', alg, 'is not yet supported')
  var s = ''
  _alg = algorithms[alg]
  return {
    update: function (data) {
      s += data
      return this
    },
    digest: function (enc) {
      enc = enc || 'binary'
      var fn 
      if(!(fn = _alg[enc]))
        error('encoding:', enc , 'is not yet supported for algorithm', alg)
      var r = fn(s)
      s = null //not meant to use the hash after you've called digest.
      return r
    }
  }
}
// the least I can do is make error messages for the rest of the node.js/crypto api.
;['createCredentials'
, 'createHmac'
, 'createCypher'
, 'createCypheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDeffieHellman',
, 'pbkdf2',
, 'randomBytes' ].forEach(function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

});

require.define("/node_modules/crypto-browserify/sha.js", function (require, module, exports, __dirname, __filename) {
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

exports.hex_sha1 = hex_sha1;
exports.b64_sha1 = b64_sha1;
exports.str_sha1 = str_sha1;
exports.hex_hmac_sha1 = hex_hmac_sha1;
exports.b64_hmac_sha1 = b64_hmac_sha1;
exports.str_hmac_sha1 = str_hmac_sha1;

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
  return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1(key, data)
{
  var bkey = str2binb(key);
  if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
  return core_sha1(opad.concat(hash), 512 + 160);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words
 * In 8-bit function, characters >255 have their hi-byte silently ignored.
 */
function str2binb(str)
{
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
  return bin;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2str(bin)
{
  var str = "";
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
  return str;
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
  }
  return str;
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64(binarray)
{
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
  }
  return str;
}


});

require.define("/node_modules/snob/repo.js", function (require, module, exports, __dirname, __filename) {
module.exports = function (deps) {
  var a = deps.diff
  var hash = deps.hash
  var EventEmitter = require('events').EventEmitter
  var u = require('./utils')

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
    revlist: function (id, since) {
      id = this.getId(id) // coerse to commit
      var revlist = []
      var exclude = since ? this.revlist(since) : []
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
    getRevs: function (head, since) {
      return this.revlist(head, since).map(this.get)
    },
    send: function (rId, branch) {
      var revs = this.getRevs(branch, this.remote(rId, branch))
      return revs
    },
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
      if(revs.length) 
        this.emit('update', revs, branch)
    },
    merge: function (branches, meta) { //branches...
      var self = this
      var mine = branches[0]
      // ensure that merging the same branches produces the same merge commit.
      branches = branches.map(this.getId).sort()
      var concestor = this.concestor(branches)
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
        update: function () {
          var _obj = self.checkout(branch)
          var delta = a.diff(obj,_obj) 
          if(!delta) return
          if(delta) a.patch(obj, delta, true)
        },
        check: function() {
          try {
            self.commit(obj)  
          } catch (e) {
            if(!/no changes/.test(e.message)) throw e
          }
        },
        stop: function () {
          self.removeListener('update', syncr.update)
          self.removeListener('preupdate', syncr._check)
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
    }
  })

  return Repository
}

});

require.define("/client.js", function (require, module, exports, __dirname, __filename) {
    
var bs = require('browser-stream')(io.connect('http://localhost:3000'))
var Docuset = require('snob/docuset')
var doc = new Docuset()

SNOB = doc.createHandler()(bs.createStream({writable: true, readable: true, name: 'test'}))

REPO = SNOB.sub('TEST')


});
require("/client.js");
