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

var Promise = global.Promise || require('promise');
var sequence = require('../util/sequence').use(Promise);

// utility functions to test async
var resolve = function(value, time) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve(value);
    }, time || 10);
  });
};

var error = new Error;

// always rejects with the same error to asses correct error rejection,
// so I can throw inside handlers and have them show as rejection failures
var reject = function(time) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      reject(error);
    }, time || 10);
  });
};

describe('sequence', function() {

  describe('find', function() {

    it('should fulfill', function() {

      return expect(sequence.find([1,2,3,4], function(value) {
        if (value === 4) return resolve(value);
        return reject();
      })).to.become(4);

    });

    it('should fulfill with values', function() {
      return expect(sequence.find([1,2,3,4], function(value) {
        if (value === 4) return value;
        throw error;
      })).to.become(4);
    });

    it('should reject', function() {

      return expect(sequence.find([1,2,3,4], function(value) {
        if (value < 5) return reject();
        return resolve(value);
      })).to.be.rejectedWith(error);

    });

    it('should reject with values', function() {
      return expect(sequence.find([1,2,3,4], function(value) {
        if (value < 5) throw error;
        return value;
      })).to.be.rejectedWith(error);
    });

  });

  describe('filter', function() {

    it('should fulfill', function() {

      return expect(sequence.filter([1,2,3,4], function(value) {
        if (value === 2) return reject();
        return resolve(value * 2);
      })).to.eventually.eql([2,6,8]);

    });

    it('should fulfill with values', function() {

      return expect(sequence.filter([1,2,3,4], function(value) {
        if (value === 2) throw error;
        return value * 2;
      })).to.eventually.eql([2,6,8]);

    });

    it('should fulfill empty', function() {

      return expect(sequence.filter([1,2,3,4], function(value) {
        return reject();
      })).to.eventually.be.empty;

    });

    it('should fulfill empty with values', function() {

      return expect(sequence.filter([1,2,3,4], function(value) {
        throw error;
      })).to.eventually.be.empty;

    });

  });

  describe('map', function() {

    it('should fulfill', function() {

      return expect(sequence.map([1,2,3,4], function(value) {
        return resolve(value * 2);
      })).to.eventually.eql([2,4,6,8]);

    });

    it('should fulfill with values', function() {

      return expect(sequence.map([1,2,3,4], function(value) {
        return value * 2;
      })).to.eventually.eql([2,4,6,8]);

    });

    it('should reject and not visit after rejection', function() {

      return expect(sequence.map([1,2,3,4], function(value) {
        expect(value).to.not.equal(3);
        expect(value).to.not.equal(4);
        if (value === 2) return reject();
        return resolve(value * 2);
      })).to.be.rejectedWith(error);

    });

    it('should reject with values, and not visit after rejection', function() {

      return expect(sequence.map([1,2,3,4], function(value) {
        expect(value).to.not.equal(3);
        expect(value).to.not.equal(4);
        if (value === 2) throw error;
        return value * 2;
      })).to.be.rejectedWith(error);

    });

  });

  describe('all', function() {

    it('should fulfill', function() {

      return expect(sequence.all([1,2,3,4], function(value) {
        return resolve(value * 2);
      })).to.eventually.eql([2,4,6,8]);

    });

    it('should fulfill with values', function() {

      return expect(sequence.all([1,2,3,4], function(value) {
        return value * 2;
      })).to.eventually.eql([2,4,6,8]);

    });

    it('should reject all', function() {

      return expect(sequence.all([1,2,3,4], function(value) {
        if (value === 2) return reject();
        return resolve(value * 2);
      })).to.be.rejectedWith(error);

    });

    it('should reject with values', function() {

      return expect(sequence.all([1,2,3,4], function(value) {
        if (value === 2) throw error;
        return value * 2;
      })).to.be.rejectedWith(error);

    });

  });

  describe('every', function() {

    it('should fulfill', function() {

      return expect(sequence.every([1,2,3,4], function(value) {
        return resolve(value * 2);
      })).to.eventually.eql([2,4,6,8]);

    });

    it('should fulfill with values', function() {

      return expect(sequence.every([1,2,3,4], function(value) {
        return value * 2;
      })).to.eventually.eql([2,4,6,8]);

    });

    it('should reject', function() {

      return expect(sequence.every([1,2,3,4], function(value) {
        if (value === 2) return reject();
        return resolve(value * 2);
      })).to.be.rejectedWith(error);

    });

    it('should reject with values', function() {

      return expect(sequence.every([1,2,3,4], function(value) {
        if (value === 2) throw error;
        return value * 2;
      })).to.be.rejectedWith(error);

    });

  });

  describe('reduce', function() {

    it('should fulfill', function() {

      return expect(sequence.reduce([2,3,4], function(previous, value) {
        return resolve(previous + value);
      }, 1)).to.eventually.equal(10);

    });

    it('should fulfill with values', function() {

      return expect(sequence.reduce([2,3,4], function(previous, value) {
        return previous + value;
      }, 1)).to.eventually.equal(10);

    });

    it('should reject and not visit after rejection', function() {

      return expect(sequence.reduce([2,3,4], function(previous, value) {
        expect(value).to.not.equal(4);
        if (value === 3) return reject();
        return resolve(previous + value);
      }, 1)).to.be.rejectedWith(error);

    });

    it('should reject with values, and not visit after rejection', function() {

      return expect(sequence.reduce([2,3,4], function(previous, value) {
        expect(value).to.not.equal(4);
        if (value === 3) throw error;
        return previous + value;
      }, 1)).to.be.rejectedWith(error);

    });

  });

  describe('race', function() {

    it('should fulfill', function() {

      return expect(sequence.race([40, 20, 60], function(time) {
        if (time === 40) reject(time);
        return resolve(time, time);
      })).to.eventually.equal(20);

    });

    it('should fulfill with values', function() {

      return expect(sequence.race([40, 20, 60], function(time) {
        if (time === 60) throw error;
        return time;
      })).to.eventually.equal(40);

    });

    it('should reject', function() {

      return expect(sequence.race([40, 20, 60], function(time) {
        if (time === 20) return reject(time);
        return resolve(time, time);
      })).to.be.rejectedWith(error);

    });

    it('should reject with values', function() {

      return expect(sequence.race([40, 20, 60], function(time) {
        if (time === 40) throw error;
        return time;
      })).to.be.rejectedWith(error);

    });

  });

});
