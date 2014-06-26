'use strict';

var esprima = require('esprima');
var escope = require('escope');

var pathogen = require('pathogen');

var contains = require('mout/array/contains');
var map = require('mout/array/map');

var Syntax = esprima.Syntax;

var declaration = function(name, init) {
  return {
    type: Syntax.VariableDeclaration,
    declarations: [{
      type: Syntax.VariableDeclarator,
      id: {
        type: Syntax.Identifier,
        name: name
      },
      init: init
    }],
    kind: "var"
  };
};

var express = function(string) {
  return esprima.parse(string).body[0].expression;
};

function injectGlobals(path, tree) {
  var self = this;

  // escope
  var global = escope.analyze(tree, { optimistic: true }).scopes[0];
  var variables = map(global.variables, function(v) { return v.name; });
  var references = map(global.through, function(r) { return r.identifier.name; });

  var needsProcess = false;
  var needsFileName = false;
  var needsDirName = false;

  if (!contains(variables, 'process') && contains(references, 'process')) {
    needsProcess = true;
  }

  if (!contains(variables, '__dirname') && contains(references, '__dirname')) {
    needsDirName = true;
  }

  if (!contains(variables, '__filename') && contains(references, '__filename')) {
    needsFileName = true;
  }

  var processName = needsProcess ? 'process' : '__process';

  var processInit = {
    type: Syntax.CallExpression,
    callee: {
      type: Syntax.Identifier,
      name: 'require'
    },
    arguments: [{
      type: Syntax.Literal,
      value: 'quickstart/browser/process'
    }]
  };

  var index = 0;

  if (!self.node && (needsProcess || needsFileName || needsDirName)) {
    tree.body.splice(index++, 0, declaration(processName, processInit));
  }

  // declare __dirname if found
  if (needsDirName) {
    var dirnameExpression =
        '(' + processName + '.cwd() + "' + pathogen.dirname(path).slice(1, -1) + '").replace(/\\/+/g, "/")';
    tree.body.splice(index++, 0, declaration('__dirname', express(dirnameExpression)));
  }

  // declare __fileName if found
  if (needsFileName) {
    var filenameExpression =
      '(' + processName + '.cwd() + "' + path.slice(1) + '").replace(/\\/+/g, "/")';

    tree.body.splice(index++, 0, declaration('__filename', express(filenameExpression)));
  }

  // declare Buffer if found
  if (!self.node && !contains(variables, 'Buffer') && contains(references, 'Buffer')) {
    var bufferExpression = '(require("buffer").Buffer)';
    tree.body.splice(index++, 0, declaration('Buffer', express(bufferExpression)));
  }

  return tree;
}

module.exports = injectGlobals;
