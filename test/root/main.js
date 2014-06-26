'use strict';

var old = require('./old'); // routing module
var fs = require('fs'); // routing native module
require('events'); // non-routing native module

// non-resolving require
var events = 'events';
require(events);

var json = require('./module.json'); // json module
var text = require('./module.txt'); // text module
var empty = require('./module.empty'); // custom module

module.exports = 'main';
