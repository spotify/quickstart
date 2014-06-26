'use strict';

var forEach = require('mout/collection/forEach');
var isInteger = require('mout/lang/isInteger');
var isArray = require('mout/lang/isArray');
var fillIn = require('mout/object/fillIn');

function Control(collection, length, keys, values, next, resolve, reject) {

  var pending = true;
  var remaining = length;

  var caught, saved;

  var done = function() {
    pending = false;
    if (caught) {
      reject(caught.error);
    } else if (saved) {
      resolve(saved.value);
    } else {
      if (isArray(collection)) {
        var result = [];
        for (var i = 0; i < length; i++) if (i in collection) result.push(collection[i]);
        resolve(result);
      } else {
        resolve(collection);
      }
    }
  };

  this.resolve = function(value) {
    if (pending) {
      pending = false;
      resolve(value);
    }
    return this;
  };

  this.reject = function(error) {
    if (pending) {
      pending = false;
      reject(error);
    }
    return this;
  };

  this.collect = function(index, value) {
    if (pending) {
      collection[keys[index]] = value;
      if (!--remaining) done();
    }
    return this;
  };

  this.catch = function(error) {
    if (pending) {
      caught = { error: error };
      if (!--remaining) done();
    }
    return this;
  };

  this.save = function(value) {
    if (pending) {
      saved = { value: value };
      if (!--remaining) done();
    }
    return this;
  };

  this.skip = function() {
    if (pending && !--remaining) done();
    return this;
  };

  this.continue = function() {
    if (pending) next();
    return this;
  };

}

var identity = function(promise) { return promise; };

function use(Promise) {

  if (!Promise) throw new Error('sequence needs a Promise implementation');

  function sequence(list, iterator, previous) {
    var length = 0;
    var keys = [];
    var values = [];

    forEach(list, function(value, key) {
      values.push(value);
      keys.push(key);
      length++;
    });

    if (!length) return Promise.resolve(previous);

    var index = 0;

    var collection = (isInteger(list.length)) ? [] : {};

    return new Promise(function(resolve, reject) {

      var control = new Control(collection, length, keys, values, next, resolve, reject);

      function next() {
        if (index === length) return;
        var current = index++;

        var key = keys[current];
        var value = values[current];

        var ctrl = fillIn({
          index: current,
          last: index === length,
          collect: function(value) {
            return control.collect(current, value);
          }
        }, control);

        previous = iterator(value, key, ctrl, previous);
      }

      next();
    });

  }

  // find
  // ├─ sequential execution
  // ├─ resolves with a value when one iterator is resolveed
  // └─ rejects with one error when the last iterator is rejected
  sequence.find = function find(values, iterator) {
    if (!iterator) iterator = identity;

    return sequence(values, function(value, key, control) {
      Promise.resolve().then(function() {
        return iterator(value, key);
      }).then(control.resolve, function(error) {
        control.catch(error).continue();
      });
    });
  };

  // filter
  // ├─ parallel execution
  // └─ always resolves with an array of values (or empty array) with the value of every resolveed iterator.
  sequence.filter = function filter(values, iterator) {
    if (!iterator) iterator = identity;

    return sequence(values, function(value, key, control) {
      Promise.resolve().then(function() {
        return iterator(value, key);
      }).then(control.collect, control.skip);
      control.continue();
    });
  };

  // map
  // ├─ sequential execution
  // ├─ resolves with an array of values representing every resolveed iterator.
  // └─ rejects when one iterator rejects
  sequence.map = function map(values, iterator) {
    if (!iterator) iterator = identity;

    return sequence(values, function(value, key, control) {
      Promise.resolve().then(function() {
        return iterator(value, key);
      }).then(function(value) {
        control.collect(value).continue();
      }, control.reject);
    });
  };

  // every
  // ├─ parallel execution
  // ├─ resolves with an array of values when all iterators are resolveed
  // ├─ rejects with the last error when one iterator is rejected
  // ├─ same as map, but parallel.
  // ├─ executes all iterators
  // └─ waits for all iterators to be either resolveed or rejected before resolving or rejecting.
  sequence.every = function every(values, iterator) {
    if (!iterator) iterator = identity;

    return sequence(values, function(value, key, control) {
      Promise.resolve().then(function() {
        return iterator(value, key);
      }).then(control.collect, control.catch);
      control.continue();
    });
  };

  // some
  // ├─ parallel execution
  // ├─ resolves with an array of values when some iterators are resolveed
  // ├─ rejects when no iterators are resolved
  // ├─ executes all iterators
  // └─ waits for all iterators to be either resolveed or rejected before resolving or rejecting.
  sequence.some = function some(values, iterator) {
    if (!iterator) iterator = identity;

    var found = false;
    return sequence(values, function(value, key, control) {
      Promise.resolve().then(function() {
        return iterator(value, key);
      }).then(function(value) {
        found = true;
        control.collect(value);
      }, function(error) {
        if (control.last && !found) control.reject(error);
        else control.skip();
      });
      control.continue();
    });
  };

  // all
  // ├─ parallel execution
  // ├─ resolves with an array of values when all iterators are resolveed
  // ├─ rejects with the first error when one iterator is rejected
  // ├─ same as map, but parallel
  // └─ executes all iterators
  sequence.all = function all(values, iterator) {
    if (!iterator) iterator = identity;

    return sequence(values, function(value, key, control) {
      Promise.resolve().then(function() {
        return iterator(value, key);
      }).then(control.collect, control.reject);
      control.continue();
    });
  };

  // reduce
  // ├─ sequential execution
  // ├─ resolves with one value when all iterators are resolveed
  // └─ rejects with one error when one iterator is rejected
  sequence.reduce = function reduce(values, iterator, init) {
    if (!iterator) iterator = identity;

    return sequence(values, function(value, key, control, promise) {
      return promise.then(function(resolved) {
        return iterator(resolved, value, key);
      }).then(function(value) {
        control.save(value).continue();
        return value;
      }, control.reject);
    }, Promise.resolve(init));
  };

  // race
  // ├─ parallel execution
  // ├─ resolves with first resolveed iterator
  // └─ rejects with first rejected iterator
  sequence.race = function race(values, iterator) {
    if (!iterator) iterator = identity;

    return sequence(values, function(value, key, control) {
      Promise.resolve().then(function() {
        return iterator(value, key);
      }).then(control.resolve, control.reject);
      control.continue();
    });
  };

  return sequence;

}

exports.use = use;
