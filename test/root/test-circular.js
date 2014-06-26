/* jshint strict:false */

var expect = require('chai').expect;

var Readable = require('./circular-a');
var Writable = require('./circular-b');

expect(Readable).to.be.a('function');
expect(Writable).to.be.a('function');

module.exports = 'test-circular';
