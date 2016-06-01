var Promise = require("bluebird");
var cache = require('memory-cache');

var MemoryStorage = function() {
  this.defaultTTL = 60;
};

MemoryStorage.prototype.setDefaulTTL = function(ttl) {
  this.defaultTTL = ttl;
};

MemoryStorage.prototype.set = function(key, value, ttl) {
  ttl = ttl || this.defaultTTL;
  cache.put(key, value, ttl * 1000);
  return Promise.resolve();
};

MemoryStorage.prototype.inc = function(key, by, ttl) {
  by = by || 1;
  ttl = ttl || this.defaultTTL;
  var currentValue = cache.get(key) || 0;
  currentValue += by;
  cache.put(key, currentValue, ttl * 1000);
  return Promise.resolve();
};

MemoryStorage.prototype.get = function(key) {
  return Promise.resolve(cache.get(key));
};

MemoryStorage.prototype.sadd = function(key, value) {
  var currentSet = cache.get(key) || [];
  if(currentSet.indexOf(value) === -1) {
    currentSet.push(value);
    cache.put(key, currentSet);
  }
  return Promise.resolve();
};

MemoryStorage.prototype.smembers = function(key) {
  var currentSet = cache.get(key) || [];
  return Promise.resolve(currentSet);
};

MemoryStorage.prototype.del = function(key) {
  cache.del(key);
  return Promise.resolve(key);
};

MemoryStorage.prototype.clear = function(key) {
  cache.clear();
  return Promise.resolve(key);
};

module.exports = MemoryStorage;