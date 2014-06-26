/* global -Promise */
'use strict';

// This is the main for node.js, and runs in node.js only.

var Promise = require('promise');

var pathogen = require('pathogen');

var esprima = require('esprima');
var escodegen = require('escodegen');
var esmangle = require('esmangle');

var QuickStart = require('./lib/quickstart');

var Resolver = require('./util/resolver');
var program = require('./util/program');
var sequence = require('./util/sequence').use(Promise);
var transport = require('./util/transport');
var Messages = require('./util/messages');

var injectGlobals = require('./transforms/inject-globals');

var resolver = new Resolver;

function compileSelf(options, appRuntimePath, appRuntimeData, messages) {

  var root = options.root;
  if (options.browserSourceMap == null) options.browserSourceMap = true;

  // Instantiate QuickStart with the root specified in options
  // which gives the QuickStart compiler a different root to work on
  // it defaults to the current working directory.
  var compiler = new QuickStart({
    messages: messages,
    loc: !!options.sourceMap,
    root: root,
    node: false,
    parsers: {},
    transforms: [injectGlobals]
  });

  // Configuration object that we will inject in the compiled compiler
  // as the compiler never reads from external sources for portability, except for builtins.
  // This includes the app's runtime as a string, parser and transforms (populated in a later step)
  // and some options.
  var config = {
    main: options.main ? pathogen(options.main) : './',
    runtimeData: appRuntimeData,
    runtimePath: pathogen.relative(root, appRuntimePath),
    sourceMap: !!options.browserSourceMap,
    defaultPath: pathogen.relative(root, options.defaultPath)
  };

  var runtimePath = pathogen(__dirname + '/runtime/browser.js');

  return sequence.map(options.parsers, function(path) {

    return compiler.require(root, path);

  }).then(function(parsers) {
    // all the resolved parser paths
    config.parsers = parsers || {};

    return sequence.map(options.transforms, function(path) {

      return compiler.require(root, path);

    });

  }).then(function(transforms) {

    // all the resolved transforms paths
    config.transforms = transforms || [];

    // Add a fake module called @config.json, in the app root, with the config object we created

    var configPath = pathogen.resolve(root, './@config.json');
    var configData = JSON.stringify(config);
    transport.cache.get[configPath] = Promise.resolve(configData);
    return compiler.parse(configPath, configData);

  }).then(function() {

    return transport(pathogen(__dirname + '/app.js'));

  }).then(function(appData) {

    return compiler.parse(pathogen.resolve(root, './@app.js'), appData);

  }).then(function(module) {
    return transport(runtimePath).then(function(runtimeData) {
      return {
        main: module.uid,
        modules: compiler.modules,
        runtimePath: runtimePath,
        runtimeData: runtimeData
      };
    });
  });

}

function compileApp(options, appRuntimePath, appRuntimeData, messages) {

  var root = options.root;

  var transforms;
  var parsers;

  return sequence.map(options.parsers, function(parserPath) {

    return resolver.resolve(root, parserPath).then(require).catch(function(error) {
      messages.group('Errors').error({
        id: 'RequireError',
        message: 'unable to require parser ' + parserPath,
        source: './'
      });
      // load error
      throw error;
    });

  }).then(function(parserModules) {
    parsers = parserModules;

    return sequence.map(options.transforms, function(transformPath) {
      return resolver.resolve(root, transformPath).then(require).catch(function(error) {
        messages.group('Errors').error({
          id: 'RequireError',
          message: 'unable to require transform ' + transformPath,
          source: './'
        });
        // load error
        throw error;
      });

    });

  }).then(function(transformModules) {

    transforms = transformModules;

    // instantiate QuickStart with parsers, transforms and options
    var compiler = new QuickStart({
      messages: messages,
      transforms: transforms,
      parsers: parsers,
      root: root,
      loc: !!options.sourceMap,
      node: options.node,
      defaultPath: options.defaultPath
    });

    return compiler.require(root, options.main ? pathogen(options.main) : './').then(function(main) {

      return {
        main: main,
        modules: compiler.modules,
        runtimePath: appRuntimePath,
        runtimeData: appRuntimeData
      };

    });

  });
}

function compile(options, messages) {

  if (options == null) options = {};

  if (!messages) messages = new Messages;

  // options.output should default to true.
  if (options.output == null) options.output = true;

  var root = options.root = options.root ? pathogen.resolve(options.root) : pathogen.cwd();
  if (options.defaultPath) options.defaultPath = pathogen.resolve(root, options.defaultPath + '/');

  var appRuntimePath;

  // Get the appropriate runtime path based on options.
  if (options.runtime) appRuntimePath = options.runtime; // let it resolve
  else if (options.node) appRuntimePath = pathogen.resolve(__dirname, './runtime/node.js');
  else appRuntimePath = pathogen.resolve(__dirname, './runtime/browser.js');

  return resolver.resolve(root, appRuntimePath).then(function(resolved) {
    return appRuntimePath = resolved;
  }).then(transport).then(function(appRuntimeData) {

    // building with --self means compiling a compiler for a browser.
    if (options.self) return compileSelf(options, appRuntimePath, appRuntimeData, messages);
    // otherwise we compile the app.
    return compileApp(options, appRuntimePath, appRuntimeData, messages);

  }).then(function(compileResult) {

    var main = compileResult.main;
    var modules = compileResult.modules;
    var runtimePath = compileResult.runtimePath;
    var runtimeData = compileResult.runtimeData;

    var runtimeSource = pathogen.relative(root, runtimePath);

    return Promise.resolve().then(function() {

      var runtimeTree = esprima.parse(runtimeData, {
        loc: !!options.sourceMap,
        source: runtimeSource
      });

      // program the full ast
      return program(main, modules, runtimeTree);

    }).catch(function(error) {
      messages.group('Errors').error({
        id: 'ParseError',
        message: 'unable to parse',
        source: pathogen.relative(root, runtimePath)
      });
      throw error;
    });

  }).then(function(tree) {
    // compress

    if (!options.compress) return tree;

    return Promise.resolve().then(function() {

      tree = esmangle.optimize(tree);
      tree = esmangle.mangle(tree);

      return tree;

    }).catch(function(error) {
      messages.group('Errors').error({
        id: 'CompressionError',
        message: error.message
      });
      throw error;
    });

  }).then(function(tree) {

    return Promise.resolve().then(function() {

      var output = escodegen.generate(tree, {
        format: options.compress ? {
          compact: true,
          parentheses: false
        } : {
          indent: { style: '  ' },
          quotes: 'single'
        },
        sourceMap: !!options.sourceMap,
        sourceMapWithCode: true
      });

      // trigger the callback with everything:
      // the sourceTree (AST) JavaScript as a string, and the sourceMap.

      return {
        ast: tree,
        source: output.code,
        sourceMap: output.map && output.map.toJSON()
      };

    }).catch(function(error) {
      messages.group('Errors').error({
        id: 'GenerationError',
        message: error.message
      });
      throw error;
    });

  });
}

module.exports = compile;
