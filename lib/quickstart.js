/* global -Promise */
'use strict';

var Promise = require('promise');

var prime = require('prime');
var pathogen = require('pathogen');

var mixIn = require('mout/object/mixIn');
var append = require('mout/array/append');
var find = require('mout/array/find');

var esprima = require('esprima');

var sequence = require('../util/sequence').use(Promise);
var transport = require('../util/transport');
var Resolver = require('../util/resolver');
var Messages = require('../util/messages');

var requireDependencies = require('../transforms/require-dependencies');

var isNative = Resolver.isNative;

// built in parsers
var parsers = {
  // The default string parser.
  // When a type is unknown it will be processed as a string.
  txt: function(path, text) {
    var tree = esprima.parse('module.exports = ""');
    tree.body[0].expression.right = {
      type: 'Literal',
      value: text
    };
    return tree;
  },

  // The default JavaScript parser.
  // When a file extension is .js it will be processed as JavaScript using esprima.
  js: function(path, text) {
    return esprima.parse(text, {loc: this.loc, source: path});
  },

  // The default JSON parser.
  // When a file extension is .json it will be processed as JavaScript using esprima.
  // No location information is necessary, as this is simply JSON.
  json: function(path, json) {
    return esprima.parse('module.exports = ' + json);
  }

};

var QuickStart = prime({

  constructor: function QuickStart(options) {
    if (!options) options = {};
    this.options = options;

    // Tells esprima to store location information.
    // This is enabled when source maps are enabled.
    // Using this makes esprima slower, but it's necessary for source maps.
    this.loc = !!options.loc;
    // Override the working directory, defaults to cwd.
    this.root = options.root ? pathogen.resolve(options.root) : pathogen.cwd();

    this.index = 0;

    this.node = !!options.node;

    this.resolver = new Resolver({
      browser: !this.node,
      defaultPath: options.defaultPath
    });

    // Initialize the modules object.
    this.modules = {};

    // Store plugins.

    this.parsers = mixIn({}, parsers, options.parsers);
    this.transforms = append(append([], options.transforms), [requireDependencies]);

    this.packages = {};

    this.messages = options.messages || new Messages;

    this.cache = {
      parse: {}
    };
  },

  // > resolve
  resolve: function(from, required) {
    var self = this;

    var messages = self.messages;

    var dir1 = pathogen.dirname(from);

    var selfPkg = /^quickstart$|^quickstart\//;
    if (selfPkg.test(required)) {
      required = pathogen(required.replace(selfPkg, pathogen(__dirname + '/../')));
    }

    return self.resolver.resolve(dir1, required).then(function(resolved) {

      if (isNative(resolved)) {
        // resolved to native module, try to resolve from quickstart.
        var dir2 = pathogen(__dirname + '/');
        return (dir1 !== dir2) ? self.resolver.resolve(dir2, required) : resolved;
      } else {
        return resolved;
      }
    }).catch(function(error) {
      messages.group('Errors').error({
        id: 'ResolveError',
        message: 'unable to resolve ' + required,
        source: pathogen.relative(self.root, from)
      });
      throw error;
    });
  },

  // resolve > transport > parse
  require: function(from, required) {
    var self = this;

    return self.resolve(from, required).then(function(resolved) {
      if (isNative(resolved)) return resolved;
      if (resolved === false) return false;

      return self.analyze(from, required, resolved).then(function() {
        return self.include(resolved);
      });
    });
  },

  // transport > parse
  include: function(path) {
    var self = this;

    var messages = self.messages;

    var uid = self.uid(path);

    var module = self.modules[uid];
    if (module) return Promise.resolve(uid);

    return transport(path).then(function(data) {
      return self.parse(path, data);
    }, function(error) {
      messages.group('Errors').error({
        id: 'TransportError',
        message: 'unable to read',
        source: pathogen.relative(self.root, path)
      });
      throw error;
    }).then(function() {
      return uid;
    });
  },

  analyze: function(from, required, resolved) {
    var self = this;

    var packages = self.packages;
    var messages = self.messages;
    var root = self.root;

    return self.resolver.findRoot(resolved).then(function(path) {
      return transport.json(path + 'package.json').then(function(json) {
        return { json : json, path: path };
      });
    }).then(function(result) {
      var path = result.path;
      var name = result.json.name;
      var version = result.json.version;

      path = pathogen.relative(root, path);

      var pkg = packages[name] || (packages[name] = []);

      var same = find(pkg, function(obj) {
        return (obj.path === path);
      });

      if (same) return;

      var instance = { version: version, path: path };
      pkg.push(instance);

      if (pkg.length > 1) {
        var group = messages.group('Warnings');

        // warn about the first at length 2
        if (pkg.length === 2) group.warn({
          id: name,
          message: 'duplicate v' + pkg[0].version + ' found',
          source: pkg[0].path
        });

        // warn about every subsequent
        group.warn({
          id: name,
          message: 'duplicate v' + version + ' found',
          source: path
        });
      }

    }, function() { }); // into the void
  },

  uid: function(full) {
    return pathogen.relative(this.root, full);
  },

  // > parse
  parse: function(full, data) {
    var self = this;

    var cache = self.cache.parse;
    if (cache[full]) return cache[full];

    var modules = self.modules;
    var messages = self.messages;

    var uid = self.uid(full);

    var relative = pathogen.relative(self.root, full);

    var module = modules[uid] = { uid: uid };

    var extname = pathogen.extname(full).substr(1);

    var parse = (extname && self.parsers[extname]) || self.parsers.txt;

    // Process flow

    // use Promise.resolve so that the (possibly) public parser can return a promise or a syntax tree.
    return cache[full] = Promise.resolve().then(function() {
      // 1. process the code to AST, based on extension
      return parse.call(self, relative, data);
    }).catch(function(error) {

      messages.group('Errors').error({
        id: 'ParseError',
        message: error.message,
        source: relative
      });

      throw error;
    }).then(function(tree) {
      // 2. transform the AST, based on specified transforms
      return self.transform(relative, tree);
    }).then(function(tree) {
      // 4. callback with module object
      module.ast = tree;
      module.path = relative;
      return module;
    });

  },

  // Apply transformations.
  transform: function(path, tree) {
    var self = this;
    // these are applied as a promises reduce operation
    return sequence.reduce(self.transforms, function(tree, transform) {
      return transform.call(self, path, tree);
    }, tree);
  }

});

module.exports = QuickStart;
