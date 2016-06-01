var Promise = require("bluebird");
var _ = require("lodash");
var EventEmitter = require("events");
var util = require("util");
var MemoryStorage = require("./storage/memory");
var RedisStorage = require("./storage/redis");
var debug = util.debuglog("templock");

function categoryCountKey(itemId, category) {
  return "count_" + itemId + "_" + category;
}
function itemCountersKey(itemId) {
  return "counter_" + itemId;
}

function itemLockKey(itemId) {
  return "lock_" + itemId;
}

function TempLock(config) {
  EventEmitter.call(this);

  config = _.clone(config);
  _.defaults(config, {
    storeTimeout: 3600,
    strategies: [
      {
        category: "main",
        attempts: 10,
        lockFor: 60
      }
    ]
  });
  this.config = config;
}

util.inherits(TempLock, EventEmitter);

TempLock.prototype.setStorage = function(storage) {
  this.storage = storage;
};

TempLock.prototype.lock = function(itemId, strategy) {
  debug("Lock", itemId, "by strategy", strategy);
  var self = this;
  var storage = this.storage;
  return storage.set(itemLockKey(itemId), 1, strategy.lockFor).then(function() {
    // empty all counters
    return storage.smembers(itemCountersKey(itemId)).then(function(categories) {
      return Promise.all(categories.map(function(category) {
        return storage.del(categoryCountKey(itemId, category));
      }));
    });
  }).then(function() {
    self.emit("lock", {
      itemId: itemId,
      strategy: strategy
    });
  });
};

TempLock.prototype.isLocked = function(itemId) {
  var storage = this.storage;
  return storage.get(itemLockKey(itemId)).then(function(value) {
    return Promise.resolve(Boolean(value));
  });
};

TempLock.prototype.getMatchedStrategies = function(category) {
  var result = [];
  this.config.strategies.forEach(function(strategy) {
    var matched = false;
    if(typeof strategy.category === "string") {
      matched = strategy.category === category;
    }
    else if(typeof strategy.category === "object" && strategy.category.test) {
      matched = strategy.category.test(category);
    }
    else {
      throw new Error("strategy.category has an invalid type");
    }
    if(matched) {
      result.push(strategy);
    }
  });
  return result;
};

TempLock.prototype.addAttempt = function(itemId, categories) {
  var self = this;
  if(!categories) {
    categories = [];
  }
  if(!Array.isArray(categories)) {
    categories = [categories];
  }
  categories.push("main");
  return Promise.all(categories.map(function(category) {
    return self.storage.inc(categoryCountKey(itemId, category)).then(function() {
      return self.storage.sadd(itemCountersKey(itemId), category);
    });
  })).then(function() {
    // check if need to lock
    return Promise.each(categories, function(category) {
      return self.storage.get(categoryCountKey(itemId, category)).then(function(countAttempts) {
        var strategies = self.getMatchedStrategies(category);
        for(var i = 0; i != strategies.length; i++) {
          var strategy = strategies[i];
          if(countAttempts >= strategy.attempts) {
            debug("detected an attempts excess for", itemId, countAttempts, ">=", strategy.attempts);
            return self.lock(itemId, strategy);
          }
        }
      });
    });
  });
};

TempLock.MemoryStorage = MemoryStorage;
TempLock.RedisStorage = RedisStorage;

module.exports = TempLock;