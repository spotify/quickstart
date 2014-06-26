/* jshint strict:false */

var expect = require('chai').expect;

var old = require('./old'); // routing module
expect(old).to.equal('old');

var oneOld = require('one/old'); // routing module
expect(oneOld).to.equal('one/old');

var fs = require('fs'); // routing native module
expect(fs).to.be.an('object');

var _debugger = require('_debugger'); // non-routing native module
expect(_debugger).to.be.an('object');

var f = require('./false');
expect(f).to.equal('false');

// non-resolving require
try {
  var xoxo = 'xoxo';
  require(xoxo);
} catch (e) {
  expect(e instanceof Error).to.be.ok;
}

var json = require('./module.json'); // json module
expect(json).to.be.an('object');

var text = require('./module.txt'); // text module
expect(text).to.be.a('string');

var empty = require('./module.empty'); // custom module
expect(empty).to.be.an('object');

module.exports = 'test-node';
