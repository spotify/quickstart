/*
Node.js runtime
*/'use strict';
/* global main, modules */

var cache = _require.cache = {};

function _require(id) {
  var module = cache[id];
  if (!module) {
    var moduleFn = modules[id];
    if (!moduleFn) throw new Error('module ' + id + ' not found');
    module = cache[id] = {};
    var exports = module.exports = {};
    moduleFn.call(exports, _require, module, exports, global);
  }
  return module.exports;
}

_require.node = require;

_require.resolve = function(resolved) {
  return resolved;
};

_require(main);
