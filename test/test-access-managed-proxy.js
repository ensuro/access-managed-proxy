const { expect } = require("chai");

const hre = require("hardhat");
const { ethers } = hre;
const { ZeroAddress } = ethers;
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { deploy: ozUpgradesDeploy } = require("@openzeppelin/hardhat-upgrades/dist/utils");

async function setUp() {
  const [admin, anon] = await ethers.getSigners();
  const DummyImplementation = await ethers.getContractFactory("DummyImplementation");
  const AccessManager = await ethers.getContractFactory("AccessManager");
  const AccessManagedProxy = await ethers.getContractFactory("AccessManagedProxy");
  const acMgr = await AccessManager.deploy(admin);

  async function deployProxy(implContract = DummyImplementation) {
    return hre.upgrades.deployProxy(implContract, [], {
      kind: "uups",
      unsafeAllow: [
        "delegatecall",
        "missing-initializer-call", // This is to fix an error because it says we are not calling
        // parent initializer
      ],
      proxyFactory: AccessManagedProxy,
      deployFunction: async (hre_, opts, factory, ...args) => ozUpgradesDeploy(hre_, opts, factory, ...args, acMgr),
    });
  }

  return {
    admin,
    anon,
    AccessManager,
    AccessManagedProxy,
    acMgr,
    DummyImplementation,
    deployProxy,
  };
}

describe("AccessManagedProxy tests", function () {
  it("Checks it can deploy the proxy", async () => {
    const { acMgr, deployProxy, AccessManagedProxy } = await helpers.loadFixture(setUp);
    const dummy = await deployProxy();
    const dummyAsAMP = AccessManagedProxy.attach(dummy);
    expect(await dummyAsAMP.ACCESS_MANAGER()).to.equal(acMgr);
  });

  it("Checks methods can be called with the right permissions", async () => {
    const { acMgr, deployProxy, AccessManagedProxy, anon, admin, DummyImplementation } =
      await helpers.loadFixture(setUp);
    const dummy = await deployProxy();
    const dummyAsAMP = AccessManagedProxy.attach(dummy);
    await expect(dummy.connect(anon).method1())
      .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedUnauthorized")
      .withArgs(anon);
    const method1Selector = DummyImplementation.interface.getFunction("method1").selector;
    // Call from admin works fine
    await expect(dummy.connect(admin).method1()).to.emit(dummy, "MethodCalled").withArgs(method1Selector);

    // Grant the permission and now anon can call
    await acMgr.setTargetFunctionRole(dummy, [method1Selector], 123);
    await acMgr.grantRole(123, anon, 0);
    await expect(dummy.connect(anon).method1()).to.emit(dummy, "MethodCalled").withArgs(method1Selector);
  });
});
