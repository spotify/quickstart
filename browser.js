/* jshint evil: true */
'use strict';


// This is the main for browsers, and runs in the browser only.

var pathogen = require('pathogen');
var escodegen = require('escodegen');
var esprima = require('esprima');

var forEach = require('mout/array/forEach');
var forIn = require('mout/object/forIn');
var map = require('mout/object/map');

var QuickStart = require('./lib/quickstart');
var program = require('./util/program');
var Messages = require('./util/messages');

var version = require('./package.json').version;

var noop = function(){};

if (!global.console) global.console = {};
if (!console.log) console.log = noop;
if (!console.warn) console.warn = console.log;
if (!console.error) console.error = console.log;
if (!console.group) console.group = console.log;
if (!console.groupCollapsed) console.groupCollapsed = console.group;
if (!console.groupEnd) console.groupEnd = noop;

var root = pathogen.cwd();

var theme = {
  red: 'color: #d44;',
  green: 'color: #6b4;',
  blue: 'color: #49d;',
  yellow: 'color: #f90;',
  grey: 'color: #666;',
  greyBright: 'color: #999;',
  bold: 'font-weight: bold;'
};

var format = function(type, statement) {
  if (type === 'group' || type === 'groupCollapsed') {

    var color;

    if ((/warning/i).test(statement)) {
      color = theme.yellow + theme.bold;
    } else if ((/error/i).test(statement)) {
      color = theme.red + theme.bold;
    } else {
      color = theme.grey + theme.bold;
    }

    console[type]('%c' + statement, color);

    return;
  }

  if (type === 'groupEnd') {
    console.groupEnd();
    return;
  }

  var message, source, line, column, id;

  message = statement.message;

  var colors = [theme.grey];

  id = statement.id;

  source = statement.source;
  line = statement.line;
  column = statement.column;

  if (source != null) {
    source = ' %c' + location.origin + pathogen.resolve(root, source);
    if (line != null) {
      source += ':' + line;
      if (column != null) {
        source += ':' + column;
      }
    }
    message += source;
    colors.push(theme.green);
  }

  message = '%c' + id + ': %c' + message;

  switch (type) {
    case 'error':
      colors.unshift(theme.red);
      console.error.apply(console, [message].concat(colors));
    break;

    case 'warn':
      colors.unshift(theme.yellow);
      console.warn.apply(console, [message].concat(colors));
    break;

    case 'time':
      colors.unshift(theme.blue);
      console.log.apply(console, [message].concat(colors));
    break;

    default:
      colors.unshift(theme.grey);
      console.log.apply(console, [message].concat(colors));
    break;
  }
};

function generate(module) {
  var sourceURL = '\n//# sourceURL=';

  var output = escodegen.generate(module.ast, {
    format: {
      indent: { style: '  ' },
      quotes: 'single'
    }
  });

  output += sourceURL + module.path.substr(2);
  return new Function('require', 'module', 'exports', 'global', output);
}

module.exports = function(config) {
  var parsers = {};
  var transforms = [];

  // config(parsers|transforms) contains resolved paths we can just require().

  forIn(config.parsers, function(id, ext) {
    var parser = require(id);
    parsers[ext] = parser;
  });

  forEach(config.transforms, function(id) {
    var transform = require(id);
    transforms.push(transform);
  });

  var messages = new Messages;
  var compilation = messages.group('Compilation');
  compilation.time('time');

  var quickstart = new QuickStart({
    messages: messages,
    parsers: parsers,
    transforms: transforms,
    loc: !!config.sourceMap,
    defaultPath: config.defaultPath,
    root: root
  });

  console.group("%cQuick%cStart " + "%cv" + version, theme.red, theme.grey, theme.greyBright);

  console.groupCollapsed('%cXMLHttpRequests', theme.grey + theme.bold);

  var modules = quickstart.modules;
  var runtimeData = config.runtimeData;
  var runtimePath = config.runtimePath;

  return quickstart.require(root, config.main).then(function(id) {
    console.groupEnd(); // XMLHttpRequests

    var done;

    if (config.sourceMap) {
      compilation.log({ id: 'sourceMap', message: 'embedded' });

      var runtimeTree = esprima.parse(runtimeData, {loc: true, source: runtimePath});

      var tree = program(id, modules, runtimeTree);

      var sourceMappingURL = '\n//# sourceMappingURL=data:application/json;base64,';

      var output = escodegen.generate(tree, {
        format: {
          indent: { style: '  ' },
          quotes: 'single'
        },
        sourceMap: true,
        sourceMapRoot: location.origin + root,
        sourceMapWithCode: true
      });

      var source = output.code + sourceMappingURL + btoa(JSON.stringify(output.map));

      done = function() { return global.eval(source); };

    } else {

      var sourceURL = '\n//# sourceURL=';

      var evaluated = map(modules, generate);

      var runtimeFn = new Function('main', 'modules', runtimeData + sourceURL + runtimePath.substr(2));

      done = function() { return runtimeFn(id, evaluated); };
    }

    compilation.timeEnd('time', 'compiled in', true, true);
    messages.print(format).reset();
    console.groupEnd(); // QuickStart

    setTimeout(function() { done(); }, 1);

  }).catch(function(error) {

    console.groupEnd(); // XMLHttpRequests
    messages.print(format).reset();
    console.groupEnd(); // QuickStart

    setTimeout(function() { throw error; }, 1); // app error;

  });

};
