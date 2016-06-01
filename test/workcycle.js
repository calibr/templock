var should = require("should");
var TempLock = require("../lib/templock");
var Promise = require("bluebird");

describe("work cycle", function() {
  var userStrategy = {
    category: /^user_[0-9]/,
    attempts: 3,
    lockFor: 2
  };
  var mainStrategy = {
    category: "main",
    attempts: 5,
    lockFor: 2
  };
  var tempLock = new TempLock({
    storeTimeout: 60,
    strategies: [
      userStrategy,
      mainStrategy
    ]
  });
  tempLock.setStorage(new TempLock.MemoryStorage());
  var itemId = "my_test_item";
  var lockEventHandlerCalls = [];

  function lockEventHandler() {
    lockEventHandlerCalls.push(Array.prototype.slice.call(arguments));
  }

  tempLock.on("lock", lockEventHandler);

  it("add attempt from user", function() {
    return tempLock.addAttempt(itemId, "user_23");
  });

  it("lockEventHandler should not be called", function() {
    lockEventHandlerCalls.length.should.equal(0);
  });

  it("add 2 more attempts", function() {
    return tempLock.addAttempt(itemId, "user_23").then(function() {
      return tempLock.addAttempt(itemId, "user_23");
    });
  });

  it("lockEventHandler should be called", function() {
    lockEventHandlerCalls.length.should.equal(1);
    var call = lockEventHandlerCalls[0];
    call[0].strategy.should.equal(userStrategy);
    call[0].itemId.should.equal(itemId);
  });

  it("item should be locked", function() {
    return tempLock.isLocked(itemId).then(function(locked) {
      locked.should.equal(true);
    });
  });

  it("item shouldn't be locked after lock time", function() {
    return tempLock.storage.clear().then(function() {
      return tempLock.isLocked(itemId).then(function(locked) {
        locked.should.equal(false);
      });
    });
  });

  it("lock item, without users", function() {
    lockEventHandlerCalls = [];
    return Promise.each(["c1", "c2", "c3", "c4", "c5"], function(category) {
      return tempLock.addAttempt(itemId, category);
    });
  });

  it("lockEventHandler should be called with main strategy", function() {
    lockEventHandlerCalls.length.should.equal(1);
    var call = lockEventHandlerCalls[0];
    call[0].strategy.should.equal(mainStrategy);
    call[0].itemId.should.equal(itemId);
  });

  it("item should be locked", function() {
    return tempLock.isLocked(itemId).then(function(locked) {
      locked.should.equal(true);
    });
  });
});