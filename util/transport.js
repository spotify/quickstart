/* global -Promise */
'use strict';

var fs = require('fs');
var pathogen = require('pathogen');
var Promise = require('promise');

var transport;
var cache = { get: {}, json: {} };

if ('readFile' in fs) {

  transport = function get(url) {
    var cached = cache.get[url];
    if (cached) return cached;

    return cache.get[url] = new Promise(function(fulfill, reject) {
      fs.readFile(pathogen.sys(url), 'utf-8', function(error, data) {
        error ? reject(error) : fulfill(data);
      });
    });
  };

} else {

  // conditional require for node.js, this could be a non-node friendly package.
  var agent = require('agent');

  // this goes easy on the browser
  agent.MAX_REQUESTS = 4;

  // we don't want agent to automatically decode json, to match the readFile behavior.
  agent.decoder('application/json', null);

  transport = function get(url) {
    var cached = cache.get[url];
    if (cached) return cached;

    return cache.get[url] = new Promise(function(fulfill, reject) {

      agent.get(url, function(error, response) {
        if (error) return reject(error);
        var status = response.status;
        if (status >= 300 || status < 200) return reject(new Error('GET ' + url + ' ' + status));

        if (pathogen.extname(url) !== '.html' && response.header['Content-Type'] === 'text/html') {
          // reject mismatching html content types (in case of file listing, treat as error)
          reject(new Error('GET ' + url + ' content-type mismatch'));
        } else {
          fulfill(response.body);
        }

      });

    });

  };

}

transport.json = function json(url) {
  var cached = cache.json[url];
  if (cached) return cached;
  return cache.json[url] = transport(url).then(JSON.parse);
};

transport.cache = cache;

module.exports = transport;
