/* jshint strict:false */

var expect = require('chai').expect;

var old = require('./old'); // routing module
expect(old).to.equal('new');

var oneOld = require('one/old'); // routing module
expect(oneOld).to.equal('one/new');

var fs = require('fs'); // routing native module
expect(fs).to.be.an('object');

var events = require('events').EventEmitter; // routing native module
expect(events).to.be.a('function');

var f = require('./false');
expect(f).to.be.an('object');

// non-resolving require
try {
  var xoxo = '_';
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

module.exports = 'test-browser';
