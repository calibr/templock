var Promise = require("bluebird");
var _ = require("lodash");
var EventEmitter = require("events");
var util = require("util");
var MemoryStorage = require("./storage/memory");
var RedisStorage = require("./storage/redis");
var debug = util.debuglog("templock");

function categoryCountKey(itemId, category) {
  return "count:" + itemId + ":" + category;
}
function itemCountersKey(itemId) {
  return "counter:" + itemId;
}

function itemLockKey(itemId, category) {
  return "lock:" + itemId + ":" + category;
}

function TempLock(config) {
  EventEmitter.call(this);

  config = config || {};
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
  this.strategies = config.strategies || [];
  this.config = config;
}

util.inherits(TempLock, EventEmitter);

TempLock.prototype.buildStrategy = function(category, attempts, lockFor) {
  return {
    category: category,
    attempts: attempts,
    lockFor: lockFor
  };
};

TempLock.prototype.setStrategies = function(strategies) {
  this.strategies = strategies;
  return this;
};

TempLock.prototype.getStrategies = function() {
  return this.strategies;
};

TempLock.prototype.setStorage = function(storage) {
  this.storage = storage;
};

TempLock.prototype.lock = function(itemId, category, strategy) {
  debug("Lock", itemId, ", category", category, "strategy", strategy);
  var self = this;
  var storage = this.storage;
  return storage.set(itemLockKey(itemId, category), 1, strategy.lockFor).then(function() {
    // empty counter
    return storage.del(categoryCountKey(itemId, category));
  }).then(function() {
    self.emit("lock", {
      itemId: itemId,
      strategy: strategy,
      category: category
    });
  });
};

TempLock.prototype.isLocked = function(itemId, categories) {
  categories =
    categories || ["main"];
  if(!Array.isArray(categories)) {
    categories = [categories];
  }
  var storage = this.storage;
  return Promise.all(categories.map(function(category) {
    return storage.get(itemLockKey(itemId, category)).then(function(value) {
      return Boolean(value);
    });
  })).then(function(values) {
    return values.indexOf(true) !== -1;
  });
};

TempLock.prototype.getMatchedStrategies = function(category) {
  var result = [];
  this.strategies.forEach(function(strategy) {
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
            return self.lock(itemId, category, strategy);
          }
        }
      });
    });
  });
};

TempLock.prototype.resetCounters = function(itemId, categories) {
  var self = this;
  var categoriesPromise;
  if(categories) {
    categoriesPromise = Promise.resolve(categories);
  }
  else {
    // reset all counters
    categoriesPromise = this.storage.smembers(itemCountersKey(itemId));
  }
  return categoriesPromise.then(function(categories) {
    return Promise.all(categories.map(function(category) {
      return self.storage.del(categoryCountKey(itemId, category));
    }));
  });
};

TempLock.MemoryStorage = MemoryStorage;
TempLock.RedisStorage = RedisStorage;

module.exports = TempLock;