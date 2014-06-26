/* global -Promise */
'use strict';

var esprima = require('esprima');
var estraverse = require('estraverse');
var Promise = require('promise');
var pathogen = require('pathogen');

var sequence = require('../util/sequence').use(Promise);

var transport = require('../util/transport');
var Resolver = require('../util/resolver');

var isNative = Resolver.isNative;

var Syntax = esprima.Syntax;

var traverse = estraverse.traverse;

var express = function(string) {
  return esprima.parse(string).body[0].expression;
};

// Find dependencies in the AST, callback the modified AST.
function requireDependencies(path, tree) {
  var self = this;

  // Finds valid require and resolve nodes.
  var requireNodes = [];
  var resolveNodes = [];
  var jsonNodes = [];

  traverse(tree, { enter: function(node, parent) {
    // callexpression, one argument
    if (node.type !== Syntax.CallExpression || node.arguments.length !== 1) return;

    var argument = node.arguments[0];

    // literal require
    if (argument.type !== Syntax.Literal) return;

    var callee = node.callee;

    if (callee.type === Syntax.Identifier && callee.name === 'require') {

      var isJSONProp = parent.type === Syntax.MemberExpression && /\.json$/.test(argument.value);
      // require('./x.json').property;
      var isNonComputedJSONProp = isJSONProp && parent.property.type === Syntax.Identifier && !parent.computed;
      // require('./x.json')["property"];
      var isLiteralJSONProp = isJSONProp && parent.property.type === Syntax.Literal;

      if (isNonComputedJSONProp) jsonNodes.push({
        node: node,
        value: argument.value,
        key: parent.property.name,
        parent: parent
      });

      else if (isLiteralJSONProp) jsonNodes.push({
        node: node,
        value: argument.value,
        key: parent.property.value,
        parent: parent
      });
      // everything else
      else requireNodes.push({
        node: node,
        value: argument.value,
        parent: parent
      });

    } else if (
      // require.resolve
      callee.type === Syntax.MemberExpression && callee.object.type === Syntax.Identifier &&
      callee.object.name === 'require' && callee.property.type === Syntax.Identifier &&
      callee.property.name === 'resolve'
    ) {
      resolveNodes.push({
        node: node,
        value: argument.value,
        parent: parent
      });
    }
  }});

  // require nodes

  var requireNodesPromise = sequence.every(requireNodes, function(result) {

    var requireNode = result.node;
    var requireNodeValue = result.value;

    return self.require(pathogen(self.root + path), requireNodeValue).then(function(uid) {
      if (uid) {

        // replace native requires with require.node
        if (isNative(uid)) requireNode.callee = {
          type: Syntax.MemberExpression,
          computed: false,
          object: {
              type: Syntax.Identifier,
              name: 'require'
          },
          property: {
              type: Syntax.Identifier,
              name: 'node'
          }
        };

        requireNode.arguments[0].value = uid; // replace require argument
      } else { // false
        // replace not found requires with {}
        // this happens when requires are nullified by the browser field
        requireNode.type = Syntax.ObjectExpression;
        requireNode.properties = [];
        delete requireNode.callee;
        delete requireNode.arguments;
      }
    });
  });

  var resolveNodesPromise = sequence.every(resolveNodes, function(result) {
    var resolveNode = result.node;
    var resolveNodeValue = result.value;
    return self.require(pathogen(self.root + path), resolveNodeValue).then(function(uid) {
      resolveNode.arguments[0].value = uid; // replace require.resolve argument
    });
  });

  var jsonNodesPromise = sequence.every(jsonNodes, function(result) {
    var jsonNodeKey = result.key;
    var jsonNodeValue = result.value;
    var jsonNodeParent = result.parent;

    return self.resolve(pathogen(self.root + path), jsonNodeValue)
    .then(transport.json)
    .then(function(json) {
      var stringValue = JSON.stringify(json[jsonNodeKey]);
      var parsedExpression = express('(' + stringValue + ')');

      var key;

      for (key in jsonNodeParent) { // empty out the old node
        if (key !== 'loc') delete jsonNodeParent[key];
      }

      for (key in parsedExpression) { // dump the new node in the old node
        jsonNodeParent[key] = parsedExpression[key];
      }

    });
  });

  // wait for those sequences to finish then return the tree
  return sequence.every([requireNodesPromise, resolveNodesPromise, jsonNodesPromise]).then(function() {
    return tree;
  });
}

module.exports = requireDependencies;
