/*
Konsole
A small utility to mimic console.group / groupEnd in node.js
prints table characters like this:
Group 1
├ message1
├ message2
├ Nested Group 1
│ └ Super Nested Group 1
│   ├ message3
│   └ message4
└ Nested Group 2
  ├ Super Nested Group 2
  │ ├ message5
  │ └ message6
  └ message7
Group 2
├ message8
└ message9
*/'use strict';

var prime = require('prime');
var isString = require('mout/lang/isString');

var slice = Array.prototype.slice;

var Message = prime({

  constructor: function(type, value, parent) {
    this.type = type;
    this.value = value;
    this.parent = parent;
  },

  print: function(last, opts) {
    if (!this.parent) return this; // don't print messages without a parent.

    if (isString(opts)) {
      var str = opts;
      opts = {};
      opts.last = opts.item = opts.join = opts.line = opts.spcr = str;
    } else {
      opts = opts || {};
      if (!opts.last) opts.last = '└─';
      if (!opts.item) opts.item = '├─';
      if (!opts.join) opts.join = '  ';
      if (!opts.line) opts.line = '│';
      if (!opts.spcr) opts.spcr = ' ';
    }

    var isRoot = !this.parent.parent;

    if (isRoot) {
      console[this.type](this.value);
    } else {
      // if printing as last item use a different character
      var chr = [last ? opts.last : opts.item];
      var parent = this;
      // recurse parents up
      while ((parent = parent.parent)) {
        var grand = parent.parent;
        // break when no parent of grandparent is found.
        if (!grand.parent) break;
        // if parent is the last parent use a different character
        var isParentLastOfGrand = (grand.values[grand.values.length - 1] === parent);
        chr.unshift(isParentLastOfGrand ? opts.spcr : opts.line);
      }
      console[this.type](chr.join(opts.join), this.value);
    }

    return this;
  }
});

var Group = prime({

  inherits: Message,

  constructor: function(type, name, parent) {
    Group.parent.constructor.call(this, type, name, parent);
    this.values = [];
  },

  push: function(stmnt) {
    this.values.push(stmnt);
    return this;
  },

  print: function(last, opts) {
    Group.parent.print.call(this, last, opts);
    var values = this.values;
    for (var i = 0; i < values.length; i++) values[i].print(i === values.length - 1, opts);
    return this;
  }

});

var Konsole = prime({

  constructor: function(type) {
    this.type = type;
    this.history = [this.current = new Group(this.type)];
  },

  write: function() {
    var parent = this.current;
    parent.push(new Message(this.type, slice.call(arguments).join(' '), parent));
    return this;
  },

  group: function(name) {
    var parent = this.current;
    var group = this.current = new Group(this.type, name, parent);
    parent.push(group);
    this.history.unshift(group);
    return this;
  },

  groupEnd: function() {
    var history = this.history;
    if (history.length > 1) {
      history.shift();
      this.current = history[0];
    }
    return this;
  },

  print: function(opts) {
    this.history[0].print(true, opts);
    return this;
  }

});

Konsole.Message = Message;
Konsole.Group = Group;

module.exports = Konsole;
