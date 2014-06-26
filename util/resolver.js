/* global -Promise*/
'use strict';

var pathogen = require('pathogen');
var prime = require('prime');

var Promise = require('promise');

var isString = require('mout/lang/isString');
var isPlainObject = require('mout/lang/isPlainObject');
var contains = require('mout/array/contains');

var transport = require('./transport');

var sequence = require('./sequence').use(Promise);

// absolute path
var absRe = /^(\/|.+:\/)/;
// relative path
var relRe = /^(\.\/|\.\.\/)/;

// implementation of http://nodejs.org/api/modules.html#modules_all_together

var natives = [
  '_debugger', '_linklist', 'assert', 'buffer', 'child_process', 'console', 'constants', 'crypto',
  'cluster', 'dgram', 'dns', 'domain', 'events', 'freelist', 'fs', 'http', 'https', 'module',
  'net', 'os', 'path', 'punycode', 'querystring', 'readline', 'repl', 'stream', '_stream_readable',
  '_stream_writable', '_stream_duplex', '_stream_transform', '_stream_passthrough',
  'string_decoder', 'sys', 'timers', 'tls', 'tty', 'url', 'util', 'vm', 'zlib'
];

var isNative = function(pkg) {
  return contains(natives, pkg);
};

var Resolver = prime({

  constructor: function(options) {
    if (!options) options = {};

    this.browser = options.browser == null ? true : !!options.browser;
    this.nodeModules = options.nodeModules || 'node_modules';
    this.defaultPath = options.defaultPath ? pathogen.resolve(options.defaultPath) : null;
  },

  // resolve required from a specific location
  // follows the browser field in package.json
  resolve: function(from, required) {
    from = pathogen.resolve(pathogen.dirname(from));

    if (isNative(required)) {
      if (!this.browser) return Promise.resolve(required);
      else return this._findRoute(this._paths(from), required);
    } else {
      if (!this.browser) return this._resolve(from, required);
      else return this._resolveAndRoute(from, required);
    }
  },

  _resolveAndRoute: function(from, required) {
    var self = this;

    return self._resolve(from, required).then(function(resolved) {
      return self._route(from, resolved);
    });
  },

  // resolve required from a specific location
  // does not follow the browser field in package.json
  _resolve: function(from, required) {
    if (relRe.test(required)) return this._load(pathogen.resolve(from, required));
    else if (absRe.test(required)) return this._load(required);
    else return this._package(from, required);
  },

  _findRouteInBrowserField: function(browser, path, resolved) {
    var self = this;

    return sequence(browser, function(value, key, control) {

      if (isNative(key)) {

        if (key === resolved) {
          if (!value) control.resolve(false);
          else self._resolveAndRoute(path, value).then(control.resolve, control.reject);
        } else {
          control.save(null).continue();
        }

      } else {

        self._resolve(path, key).then(function(res) {
          if (res === resolved) {
            if (!value) control.resolve(false);
            else self.resolve(path, value).then(control.resolve, control.reject);
          } else {
            control.save(null).continue();
          }
        }, control.reject);

      }

    });
  },

  _findRoute: function(paths, resolved) {
    var self = this;
    return sequence(paths, function(path, i, control) {

      transport.json(path + 'package.json').then(function(json) {

        if (isPlainObject(json.browser)) {

          self._findRouteInBrowserField(json.browser, path, resolved).then(function(route) {
            if (route === null) control.save(resolved).continue(); // no route found
            else control.resolve(route);
          }, control.reject);

        } else {

          control.save(resolved).continue();

        }

      }, function(/*read json error*/) {
        control.save(resolved).continue();
      });

    });

  },

  // finds the routed entry in the browser field in package.json
  // when not found it will simply callback resolved
  _route: function(from, resolved) {
    var self = this;

    var paths = self._paths(from);

    return self.findRoot(resolved).then(function(path) {
      if (paths[0] !== path) paths.unshift(path);
      return self._findRoute(paths, resolved);
    });
  },

  // resolves either a file or a directory to a module, based on pattern
  _load: function(required) {
    var self = this;
    var promise = Promise.reject();
    if (!(/\/$/).test(required)) promise = self._file(required);
    return promise.catch(function() {
      return self._directory(required);
    });
  },

  // resolves a file name to a module
  _file: function(required) {
    var exts = ['.js'];

    if (pathogen.extname(required)) exts.unshift('');

    return sequence.find(exts, function(ext) {
      var path = required + ext;
      return transport(required + ext).then(function() {
        return path;
      });
    });
  },

  // resolves a directory to a module
  // takes into account the main field (or browser field as string)
  _directory: function(full) {
    var self = this;

    return transport.json(full + 'package.json').catch(function() {
      return {};
    }).then(function(json) {
      var main = isString(json.browser) ? json.browser : (json.main || 'index');
      return self._file(pathogen.resolve(full, main));
    });
  },

  // resolves a packaged require to a module
  _package: function(from, required) {
    var self = this;

    var split = required.split('/');
    var packageName = split.shift();

    // make it into an explicit folder if it's only a package
    if (required.indexOf('/') === -1) required += '/';

    return self.resolvePackage(from, packageName).then(function(jsonPath) {
      return self._load(pathogen.dirname(jsonPath) + split.join('/'));
    });
  },

  // generates a list of possible node modules paths
  _paths: function(path) {
    var node_modules = this.nodeModules;

    var paths = [];
    var parts = (path).split('/').slice(1, -1);

    for (var i = parts.length, part; i; part = parts[i--]) {
      if (part === node_modules) continue;
      var dir = '/' + parts.slice(0, i).join('/') + '/';
      paths.push(dir);
    }
    paths.push('/');
    if (this.defaultPath) paths.push(this.defaultPath);
    return paths;
  },

  resolvePackage: function(path, packageName) {
    var self = this;
    var node_modules = self.nodeModules;

    path = pathogen.resolve(pathogen.dirname(path));

    var paths = self._paths(path);

    return sequence.find(paths, function(path) {
      var jsonPath = path + node_modules + '/' + packageName + '/package.json';

      return transport(jsonPath).then(function() {
        return jsonPath;
      });

    });
  },

  // find the package root of a specified file (or dir)
  findRoot: function(path) {
    var self = this;
    var paths = self._paths(pathogen.resolve(pathogen.dirname(path)));

    return sequence.find(paths, function(path) {
      return transport(path + 'package.json').then(function() {
        return path;
      });
    });

  }

});

Resolver.natives = natives;
Resolver.isNative = isNative;

module.exports = Resolver;
