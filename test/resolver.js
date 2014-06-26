/* jshint strict:false */
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

var pathogen = require('pathogen');

var Resolver = require('../util/resolver');

var resolver = new Resolver;

var resolve = function(path) {
  return resolver.resolve(pathogen(__dirname + '/root/'), path);
};

var relative = function(path) {
  return pathogen.relative(pathogen(__dirname + '/root/'), path);
};

describe('QuickStart Resolver', function() {

  it('should resolve a relative module', function() {
    return expect(resolve('./index').then(relative)).to.eventually.equal('./index.js');
  });

  it('should resolve the main', function() {
    return expect(resolve('./').then(relative)).to.eventually.equal('./main.js');
  });

  it('should resolve a package with implicit index.js main', function() {
    return expect(resolve('one').then(relative)).to.eventually.equal('./node_modules/one/index.js');
  });

  it('should resolve a package with specified main', function() {
    return expect(resolve('two').then(relative)).to.eventually.equal('./node_modules/two/two.js');
  });

  it('should resolve a package with specified module', function() {
    return expect(resolve('two/two').then(relative)).to.eventually.equal('./node_modules/two/two.js');
  });

  it('should resolve a package with specified module giving priority to file matches', function() {
    return expect(resolve('two/lib').then(relative)).to.eventually.equal('./node_modules/two/lib.js');
  });

  it('should resolve a package with specified module giving priority to folder matches', function() {
    return expect(resolve('two/lib/').then(relative)).to.eventually.equal('./node_modules/two/lib/index.js');
  });

  it('should resolve a package with specified module index.js', function() {
    return expect(resolve('two/lib2').then(relative)).to.eventually.equal('./node_modules/two/lib2/index.js');
  });

  it('should resolve a package with specified module index.js', function() {
    return expect(resolve('two/lib2/').then(relative)).to.eventually.equal('./node_modules/two/lib2/index.js');
  });

  it('should use the browser field to resolve faux packages', function() {
    return expect(resolve('fs').then(relative)).to.eventually.equal('./lib/fs.js');
  });

  it('should use the browser field to swap local modules', function() {
    return expect(resolve('./old.js').then(relative)).to.eventually.equal('./new.js');
  });

  it('should resolve browser keys to swap local modules', function() {
    return expect(resolve('./old').then(relative)).to.eventually.equal('./new.js');
  });

  it('should use the browser field to resolve main modules', function() {
    return expect(resolve('three').then(relative)).to.eventually.equal('./node_modules/three/lib/three.js');
  });

  it('should use the browser field to resolve package modules', function() {
    return expect(resolve('one/old').then(relative)).to.eventually.equal('./node_modules/one/new.js');
  });

  it('should use the browser field to resolve falsy modules to false', function() {
    return expect(resolve('./false')).to.eventually.equal(false);
  });

  it('should use the browser field to resolve falsy packages to false', function() {
    return expect(resolve('four')).to.eventually.equal(false);
  });

  it('should resolve a package with specified main overridden by the browser field', function() {
    return expect(resolve('five').then(relative)).to.eventually.equal('./node_modules/five/browser.js');
  });

  it('should resolve a package with specified module overridden by the browser field', function() {
    return expect(resolve('five/old').then(relative)).to.eventually.equal('./node_modules/five/new.js');
  });

  it('should return an error for unresolvable modules', function() {
    return expect(resolve('./null')).to.be.rejected;
  });

  it('should return an error for unresolvable packages', function() {
    return expect(resolve('non-existing-package')).to.be.rejected;
  });

  it('should resolve unmatched core_modules to the base value', function() {
    return expect(resolve('_debugger')).to.eventually.equal('_debugger');
  });

});
