'use strict';

exports.title = document.title;
exports.browser = true;

exports.cwd = function() {
  return location.pathname.split(/\/+/g).slice(0, -1).join('/') || '/';
};
