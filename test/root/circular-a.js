/* jshint strict:false */

var expect = require('chai').expect;

module.exports = Readable;
var Writable = require('./circular-b');

expect(Readable).to.be.a('function');
expect(Readable.name).to.equal('Readable');
expect(Writable).to.be.a('function');
expect(Writable.name).to.equal('Writable');

function Readable() {};
