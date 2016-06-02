var should = require("should");
var TempLock = require("../lib/templock");
var Promise = require("bluebird");

describe("Misc", function() {
  var tempLock = new TempLock();
  tempLock.setStorage(new TempLock.MemoryStorage());

  it("should build a strategy", function() {
    var strategy = tempLock.buildStrategy("myStrategy", "category", 10, 20);
    strategy.name.should.equal("myStrategy");
    strategy.category.should.equal("category");
    strategy.attempts.should.equal(10);
    strategy.lockFor.should.equal(20);
  });

  it("get/set strategies", function() {
    var strategy = {
      name: "test",
      category: "test2",
      attempts: 10,
      lockFor: 20
    };
    var tempLock = new TempLock({
      strategies: [strategy]
    });
    var strategies = tempLock.getStrategies();
    strategies.length.should.equal(1);
    strategies[0].should.equal(strategy);

    var strategy2 = tempLock.buildStrategy("myStrategy", "category", 10, 20);
    tempLock.setStrategies([strategy2]);
    strategies = tempLock.getStrategies();
    strategies.length.should.equal(1);
    strategies[0].should.equal(strategy2);
  });
});