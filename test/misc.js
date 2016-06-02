var should = require("should");
var TempLock = require("../lib/templock");
var Promise = require("bluebird");

describe("Misc", function() {
  var tempLock = new TempLock();
  tempLock.setStorage(new TempLock.MemoryStorage());

  it("should build a strategy", function() {
    var strategy = tempLock.buildStrategy("category", 10, 20);
    strategy.category.should.equal("category");
    strategy.attempts.should.equal(10);
    strategy.lockFor.should.equal(20);
  });
});