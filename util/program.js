'use strict';

var esprima = require('esprima');
var forIn = require('mout/object/forIn');

var Syntax = esprima.Syntax;

// This generates the full single-file AST, with the runtime and modules.
// main and modules will get fed to the runtime.
module.exports = function program(main, modules, runtime){
  var Program = esprima.parse('(function(main, modules) {})({})');

  var Runtime = runtime;
  Runtime.type = Syntax.BlockStatement; // change to a BlockStatement
  Program.body[0].expression.callee.body = Runtime;

  var ProgramArguments = Program.body[0].expression.arguments;
  var ObjectExpression = ProgramArguments[0];
  ProgramArguments.unshift({
    type: Syntax.Literal,
    value: main
  });

  forIn(modules, function(module, id) {
    var tree = module.ast;
    var ModuleProgram = esprima.parse('(function(require, module, exports, global){})');
    tree.type = Syntax.BlockStatement; // change to a BlockStatement
    ModuleProgram.body[0].expression.body = tree;

    ObjectExpression.properties.push({
      type: Syntax.Property,
      key: {
        type: Syntax.Literal,
        value: id
      },
      value: ModuleProgram.body[0].expression,
      kind: 'init'
    });
  });

  return Program;
};
