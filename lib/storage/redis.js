var Promise = require("bluebird");
var Redis = require("redis");

Promise.promisifyAll(Redis.RedisClient.prototype);
Promise.promisifyAll(Redis.Multi.prototype);

var RedisStorage = function(config) {
  config = config || {};
  if(typeof config.hset === "function") {
    this.connection = config;
  }
  else {
    config.prefix = config.prefix || "templock:";
    this.connection = Redis.createClient(config);
  }

  this.defaultTTL = 60;
};

RedisStorage.prototype.setDefaulTTL = function(ttl) {
  this.defaultTTL = ttl;
};

RedisStorage.prototype._key = function(key) {
  return key;
};

RedisStorage.prototype.set = function(key, value, ttl) {
  ttl = ttl || this.defaultTTL;
  key = this._key(key);
  return this.connection.setexAsync(key, ttl, value);
};

RedisStorage.prototype.inc = function(key, by, ttl) {
  var self = this;
  ttl = ttl || this.defaultTTL;
  by = by || 1;
  key = this._key(key);
  return this.connection.incrbyAsync(key, by).then(function() {
    return self.connection.expireAsync(key, ttl);
  });
};

RedisStorage.prototype.get = function(key, value, ttl) {
  return this.connection.getAsync(this._key(key));
};

RedisStorage.prototype.sadd = function(key, value, ttl) {
  var self = this;
  ttl = ttl || this.defaultTTL;
  return this.connection.saddAsync(self._key(key), value).then(function() {
    return self.connection.expireAsync(self._key(key), ttl);
  });
};

RedisStorage.prototype.smembers = function(key) {
  return this.connection.smembersAsync(this._key(key));
};

RedisStorage.prototype.del = function(key) {
  return this.connection.delAsync(this._key(key));
};

module.exports = RedisStorage;

