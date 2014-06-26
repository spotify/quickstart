/* jshint strict:false, evil: true */
/* global describe, it */

var chai = require('chai');
chai.use(require('chai-as-promised'));
var expect = chai.expect;

/*
useful methods
├─ .to.be.fulfilled
├─ .to.be.rejected
├─ .to.be.rejectedWith()
├─ .to.eventually.equal()
├─ .to.eventually.eql()
└─ .to.become()
*/

var quickstart = require('../');

// these test check the output of required modules.

describe('quickstart', function() {

  it('should compile a simple module, using the browser resolver', function() {

    return expect(quickstart({
      transforms: ['../transforms/passthrough'],
      parsers: { empty: '../parsers/empty' },
      sourceMap: true,
      root: __dirname + '/root/',
      runtime: '../../runtime/node',
      main: './test-browser'
    }).then(function(result) {
      expect(result.source).to.be.a('string');
      expect(result.ast).to.be.an('object');
      expect(result.sourceMap).to.be.an('object');
      eval(result.source);
    })).to.be.fulfilled;

  });

  it('should compile a simple module, using the node resolver', function() {

    return expect(quickstart({
      transforms: ['../transforms/passthrough'],
      parsers: { empty: '../parsers/empty' },
      compress: true,
      node: true,
      root: __dirname + '/root/',
      main: './test-node'
    }).then(function(result) {
      expect(result.source).to.be.a('string');
      expect(result.ast).to.be.an('object');
      eval(result.source);
    })).to.be.fulfilled;

  });

  it('should compile itself', function() {

    return expect(quickstart({
      self: true,
      output: false,
      root: __dirname + '/../'
    }).then(function(result) {
      expect(result.ast).to.be.an('object');
    })).to.be.fulfilled;

  });

  it('should handle browser require-based errors', function() {

    return expect(quickstart({
      output: false,
      compress: true,
      root: __dirname + '/root/',
      main: './invalid-require.js'
    })).to.be.rejected;

  });

  it('should handle node require-based errors', function() {

    return expect(quickstart({
      root: __dirname + '/root/',
      main: './invalid-require.js',
      node: true
    })).to.be.rejected;

  });

  it('should handle javascript errors', function() {

    return expect(quickstart({
      root: __dirname + '/root/',
      main: './invalid-javascript.js'
    })).to.be.rejected;

  });

  it('should handle not found transforms errors', function() {

    return expect(quickstart({
      self: true,
      transforms: ['./does-not-exist'],
      root: __dirname + '/../'
    })).to.be.rejected;

  });

  it('should handle not found parsers errors', function() {

    return expect(quickstart({
      self: true,
      parsers: { empty: './does-not-exist' },
      root: __dirname + '/../'
    })).to.be.rejected;

  });

  it('should handle transforms plugin errors', function() {

    return expect(quickstart({
      transforms: ['../transforms/error'],
      root: __dirname + '/root/'
    })).to.be.rejected;

  });

  it('should handle parser plugin errors', function() {

    return expect(quickstart({
      parsers: { empty: '../parsers/error' },
      root: __dirname + '/root/'
    })).to.be.rejected;

  });

  it('should require circular dependencies', function() {

    return expect(quickstart({
      root: __dirname + '/root/',
      runtime: '../../runtime/node',
      main: './test-circular'
    }).then(function(result) {
      eval(result.source);
    })).to.be.fulfilled;

  });

});
