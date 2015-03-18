/* jshint strict:false */

var expect = require('chai').expect;

var jsonModule = require('./module.json');
expect(jsonModule).to.be.an('object');
expect(jsonModule.animals).to.be.an('array');

var animals = require('./module.json').animals;
expect(animals).to.be.an('array');

var animals2 = require('./module.json')['animals'];
expect(animals2).to.be.an('array');

var hasProperty = require('./module.json').hasOwnProperty('animals');
expect(hasProperty).to.equal(true);

module.exports = 'test-json';
