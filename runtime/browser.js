/*
Browser runtime
*/'use strict';
/* global main, modules, -require, -module, -exports, -global */

var cache = require.cache = {};

function require(id) {
  var module = cache[id];
  if (!module) {
    var moduleFn = modules[id];
    if (!moduleFn) throw new Error('module ' + id + ' not found');
    module = cache[id] = {};
    var exports = module.exports = {};
    moduleFn.call(exports, require, module, exports, window);
  }
  return module.exports;
}

require.resolve = function(resolved) {
  return resolved;
};

require.node = function() {
  return {};
};

require(main);
