'use strict';

var fs = require('fs');

var requireRelative = require('require-relative');

var clc = require('cli-color');

var pathogen = require('pathogen');

var isString = require('mout/lang/isString');
var forIn = require('mout/object/forIn');
var mixIn = require('mout/object/mixIn');
var isArray = require('mout/lang/isArray');
var camelCase = require('mout/string/camelCase');

var Konsole = require('../util/konsole');
var Messages = require('../util/messages');

var compile = require('../');
var manifest = require('../package.json');

// # argv
module.exports = function(argv) {

  var root = argv.root;

  if (argv.config == null) argv.config = pathogen.resolve(root, './quickstart.json');

  if (argv.o != null) {
    argv.output = argv.o;
    delete argv.o;
  }

  if (argv.parsers) {
    var parsers = {};
    if (!isArray(argv.parsers)) argv.parsers = [argv.parsers];
    argv.parsers.forEach(function(parser) {
      var parts = parser.split('=');
      parsers[parts[0].trim()] = parts[1].trim();
    });
    argv.parsers = parsers;
  }

  if (argv.transforms) {
    if (!isArray(argv.transforms)) argv.transforms = [argv.transforms];
  }

  var jsonConf;

  if (/\.json$/.test(argv.config)) try {
    jsonConf = requireRelative(pathogen(argv.config), root);
  } catch(e) {}

  var options = {};

  // augment options with config file, if specified and valid
  if (jsonConf) mixIn(options, jsonConf);

  // augment options with argv
  forIn(argv, function(value, name) {
    if (name.length > 1 && name !== 'config' && name !== 'version' && name !== 'help') {
      options[camelCase(name)] = value;
    }
  });

  if (!options.parsers) options.parsers = {};
  if (!options.transforms) options.transforms = [];

  // clean up options.output
  if (options.output == null) options.output = true;

  // # help konsole

  var help = new Konsole('log');

  var logo = 'QuickStart ' + clc.white('v' + manifest.version);

  help.group(logo);
  help.write('');

  help.write(clc.green('--self       '),
    'compile quickstart for browser compilation. defaults to', clc.red('false'));

  help.write(clc.green('--root       '),
    'use this as the root of each path. defaults to', clc.blue(pathogen.cwd()));

  help.write(clc.green('--main       '),
    'override the default entry point. defaults to', clc.red('false'));

  help.write(clc.green('--output, -o '),
    'output the compiled source to a file or STDOUT. defaults to', clc.blue('STDOUT'));

  help.write(clc.green('--source-map '),
    'output the source map to a file, STDOUT or inline. defaults to', clc.red('false'));

  help.write(clc.green('--ast        '),
    'output the Esprima generated AST to a file or STDOUT. defaults to', clc.red('false'));

  help.write(clc.green('--optimize   '),
    'feed transforms with an optimized ast. defaults to', clc.red('false'));

  help.write(clc.green('--compress   '),
    'compress the resulting AST using esmangle. defaults to', clc.red('false'));

  help.write(clc.green('--runtime    '),
    'specify a custom runtime. defaults to', clc.red('false'));

  help.write(clc.green('--config     '),
    'specify a configuration json file to augment command line options. defaults to', clc.red('false'));

  help.write(clc.green('--help, -h   '),
    'display this help screen');

  help.write(clc.green('--version, -v'),
    'display the current version');

  help.write('');

  help.groupEnd(); // QuickStart

  // # help command

  var printOptions = {
    last: clc.whiteBright('└─'),
    item: clc.whiteBright('├─'),
    join: clc.whiteBright('  '),
    line: clc.whiteBright('│'),
    spcr: clc.whiteBright(' ')
  };

  if (argv.help || argv.h) {
    help.print(' ');
    process.exit(0);
  }

  // # version command

  if (argv.version || argv.v) {
    console.log('v' + manifest.version);
    process.exit(0);
  }

  // # beep beep

  var beep = function() {
    process.stderr.write('\x07'); // beep!
  };

  // # format messages

  function format(type, statement) {

    if (type === 'group' || type === 'groupCollapsed') {
      if ((/warning/i).test(statement)) {
        konsole.group(clc.yellow(statement));
      } else if ((/error/i).test(statement)) {
        konsole.group(clc.red(statement));
      } else {
        konsole.group(statement);
      }
      return;
    }

    if (type === 'groupEnd') {
      konsole.groupEnd();
      return;
    }

    var message, source, line, column, id;

    message = statement.message;

    id = statement.id;

    source = statement.source;
    line = statement.line;
    column = statement.column;

    if (source != null) {
      source = clc.green(pathogen.resolve(root, source));
      if (line != null) {
        source += ' on line ' + line;
        if (column != null) {
          source += ', column' + column;
        }
      }
      message = message ? [message, source].join(' ') : source;
    }

    switch (type) {
      case 'error':
        konsole.write(clc.red(id + ': ') + message);
      break;
      case 'warn':
        konsole.write(clc.yellow(id + ': ') + message);
      break;
      case 'time':
        konsole.write(clc.blue(id + ': ') + message);
      break;
      default:
        konsole.write(id + ': ' + message);
      break;
    }

  }

  var messages = new Messages(logo);
  var konsole = new Konsole('error');

  var compilation = messages.group('Compilation');
  compilation.time('time');

  var optionsGroup = messages.group('Options');
  forIn(options, function(value, key) {
    var string = JSON.stringify(value);
    if (string) optionsGroup.log({ id: key, message: string });
  });

  compile(options, messages).then(function(compiled) {

    var ast = compiled.ast;
    var source = compiled.source;
    var sourceMap = compiled.sourceMap;

    if (source) source = '/* compiled with ' + manifest.name + '@' + manifest.version + ' */' + source;

    if (options.output && options.sourceMap === true) {
      sourceMap = JSON.stringify(sourceMap);
      source += '\n//# sourceMappingURL=data:application/json;base64,' + new Buffer(sourceMap).toString('base64');
      compilation.log({ id: 'source map', message: 'embedded' });
    }

    if (isString(options.sourceMap)) {
      var sourceMapPath = pathogen.resolve(root, options.sourceMap);
      fs.writeFileSync(pathogen.sys(sourceMapPath), JSON.stringify(sourceMap));
      if (options.output) source += '\n//# sourceMappingURL=' + pathogen.relative(root, sourceMapPath);

      compilation.log({ id: 'sourceMap', message: 'file written', source: pathogen.relative(root, sourceMapPath) });
    }

    if (isString(options.output)) {
      var sourcePath = pathogen.sys(pathogen.resolve(root, options.output));
      fs.writeFileSync(sourcePath, source);
      compilation.log({ id: 'source', message: 'file written', source: pathogen.relative(root, sourcePath) });
    }

    if (isString(options.ast)) {
      var astPath = pathogen.sys(pathogen.resolve(root, options.ast));
      fs.writeFileSync(astPath, JSON.stringify(ast));

      compilation.log({ id: 'ast', message: 'file written', source: pathogen.relative(root, astPath) });
    }

    if (options.ast === true) {
      console.log(JSON.stringify(ast));

      compilation.log({ id: 'ast', message: 'stdout' });
    } else if (options.output === true) {
      console.log(source);

      compilation.log({ id: 'source', message: 'stdout' });
    } else if (options.sourceMap === true) {
      console.log(sourceMap);

      compilation.log({ id: 'sourceMap', message: 'stdout' });
    }

    compilation.timeEnd('time', options.self ? 'compiled itself in' : 'compiled in', true, true);

    messages.print(format);
    konsole.print(printOptions);
    messages.reset();

    beep();

  }).catch(function(error) {

    messages.print(format);
    konsole.print(printOptions);

    beep(); beep(); // beepbeep!
    process.nextTick(function() {
      throw error;
    });
    return;
  });

};
