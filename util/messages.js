/*
simple messages
- log / error / warn
- messages = new Messages;
- messages.group(groupName).log(message);
- messages.group(groupName) === message.group(groupName);
- messages.group(groupName).group(subGroupName).log(message);
- messages.group(groupName).group(subGroupName).log(message);
- messages.log(message);
- messages.print(printer); // printer is a simple function that gets (type, message).
*/'use strict';

var prime = require('prime');

var forIn = require('mout/object/forIn');
var forEach = require('mout/array/forEach');
var size = require('mout/object/size');

var now = require('performance-now');

var Message = prime({

  constructor: function(type, statement) {
    this.type = type;
    this.statement = statement;
  }

});

var Messages = prime({

  constructor: function(name) {
    this.name = name;
    this.reset();
  },

  group: function(name, collapsed) {
    var group = this.groups[name] || (this.groups[name] = new Messages(name));
    group.collapsed = !!collapsed;
    return group;
  },

  groupCollapsed: function(name) {
    return this.group(name, true);
  },

  error: function(statement) {
    this.messages.push(new Message('error', statement));
    return this;
  },

  warn: function(statement) {
    this.messages.push(new Message('warn', statement));
    return this;
  },

  info: function(statement) {
    this.messages.push(new Message('info', statement));
    return this;
  },

  log: function(statement) {
    return this.info(statement);
  },

  time: function(id) {
    this.timeStamps[id] = now();
    return this;
  },

  timeEnd: function(id, name) {
    var timestamp = this.timeStamps[id];
    if (timestamp) {
      var end = now() - timestamp;
      var timeStamp = end + ' milliseconds';
      this.messages.push(new Message('time', {id: name || id, message: timeStamp}));
    }
    return this;
  },

  print: function(format) {
    if (!this.messages.length && !size(this.groups)) return;

    if (this.name) format(this.collapsed ? 'groupCollapsed' : 'group', this.name);

    forIn(this.groups, function(group) {
      group.print(format);
    });

    forEach(this.messages, function(message) {
      format(message.type, message.statement);
    });

    if (this.name) format('groupEnd');

    return this;
  },

  reset: function() {
    this.messages = [];
    this.groups = {};
    this.timeStamps = {};
  }

});

module.exports = Messages;
