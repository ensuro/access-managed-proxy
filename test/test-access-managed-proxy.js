const { expect } = require("chai");

const hre = require("hardhat");
const { ethers } = hre;
const { tagitVariant, setupAMRole } = require("@ensuro/utils/js/utils");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { deploy: ozUpgradesDeploy } = require("@openzeppelin/hardhat-upgrades/dist/utils");

async function setUpCommon() {
  const [admin, anon] = await ethers.getSigners();
  const DummyImplementation = await ethers.getContractFactory("DummyImplementation");
  const AccessManager = await ethers.getContractFactory("AccessManager");

  return {
    admin,
    anon,
    AccessManager,
    DummyImplementation,
  };
}

async function setUpAMP() {
  const ret = await setUpCommon();
  const AccessManagedProxy = await ethers.getContractFactory("AccessManagedProxy");
  const { admin, AccessManager, DummyImplementation } = ret;
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
    acMgr,
    AccessManagedProxy,
    deployProxy,
    ...ret,
  };
}

function randomSelector() {
  return (
    "0x" +
    Math.floor(Math.random() * 2 ** 32)
      .toString(16)
      .padStart(8, "0")
  );
}

async function setUpAMP2(nMethods = 10) {
  const ret = await setUpCommon();
  const { admin, AccessManager, DummyImplementation } = ret;
  const AccessManagedProxy2 = await ethers.getContractFactory("AccessManagedProxy2");
  const acMgr = await AccessManager.deploy(admin);

  async function deployProxy(implContract = DummyImplementation) {
    const selector = implContract.interface.getFunction("callThruAMPSkippedMethod").selector;
    const selectors = [...Array(nMethods - 1).keys()].map(randomSelector);
    selectors.push(selector);
    selectors.sort();
    console.log("selectors", selectors, selector, selectors.indexOf(selector));
    return hre.upgrades.deployProxy(implContract, [], {
      kind: "uups",
      unsafeAllow: [
        "delegatecall",
        "missing-initializer-call", // This is to fix an error because it says we are not calling
        // parent initializer
      ],
      proxyFactory: AccessManagedProxy2,
      deployFunction: async (hre_, opts, factory, ...args) =>
        ozUpgradesDeploy(hre_, opts, factory, ...args, acMgr, selectors),
    });
  }

  return {
    acMgr,
    AccessManagedProxy: AccessManagedProxy2,
    deployProxy,
    ...ret,
  };
}

async function setUpDirect() {
  const ret = await setUpCommon();

  async function deployProxy(implContract = ret.DummyImplementation) {
    return implContract.deploy();
  }

  return {
    acMgr: null,
    deployProxy,
    ...ret,
  };
}

async function setUpERC1967() {
  const ret = await setUpCommon();

  async function deployProxy(implContract = ret.DummyImplementation) {
    return hre.upgrades.deployProxy(implContract, [], {
      kind: "uups",
    });
  }

  return {
    acMgr: null,
    deployProxy,
    ...ret,
  };
}

// const variants = [{ name: "NoProxy" }, { name: "ERC1967Proxy" }, { name: "AccessManagedProxy" }];
const variants = [
  { name: "NoProxy", fixture: setUpDirect, method: "callDirect", hasAC: false },
  { name: "AccessManagedProxy", fixture: setUpAMP, method: "callThruAMP", hasAC: true },
  { name: "ERC1967Proxy", fixture: setUpERC1967, method: "callThru1967", hasAC: false },
  { name: "AccessManagedProxy2", fixture: setUpAMP2, method: "callThruAMPNonSkippedMethod", hasAC: true, isAMP2: true },
  {
    name: "AccessManagedProxy2Long",
    fixture: async () => setUpAMP2(24),
    method: "callThruAMPNonSkippedMethod",
    hasAC: true,
    isAMP2: true,
  },
  {
    name: "AccessManagedProxy2Short",
    fixture: async () => setUpAMP2(4),
    method: "callThruAMPNonSkippedMethod",
    hasAC: true,
    isAMP2: true,
  },
];

variants.forEach((variant) => {
  // eslint-disable-next-line func-style
  const it = (testDescription, test) => tagitVariant(variant, false, testDescription, test);
  it.only = (testDescription, test) => tagitVariant(variant, true, testDescription, test);

  describe(`AccessManagedProxy tests - variant: ${variant.name}`, function () {
    it("Checks it can deploy the proxy [?hasAC]", async () => {
      const { acMgr, deployProxy, AccessManagedProxy } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      const dummyAsAMP = AccessManagedProxy.attach(dummy);
      expect(await dummyAsAMP.ACCESS_MANAGER()).to.equal(acMgr);
    });

    it("Checks methods can be called with the right permissions [?hasAC]", async () => {
      const { acMgr, deployProxy, AccessManagedProxy, anon, admin, DummyImplementation } = await helpers.loadFixture(
        variant.fixture
      );
      const dummy = await deployProxy();
      const dummyAsAMP = AccessManagedProxy.attach(dummy);
      await expect(dummy.connect(anon)[variant.method]())
        .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedUnauthorized")
        .withArgs(anon);
      const methodSelector = DummyImplementation.interface.getFunction(variant.method).selector;
      // Call from admin works fine
      await expect(dummy.connect(admin)[variant.method]()).to.emit(dummy, "MethodCalled").withArgs(methodSelector);

      // Grant the permission and now anon can call
      await setupAMRole(acMgr, dummy, { DUMMY: 123 }, "DUMMY", [variant.method]);
      await acMgr.grantRole(123, anon, 0);
      await expect(dummy.connect(anon)[variant.method]()).to.emit(dummy, "MethodCalled").withArgs(methodSelector);
    });

    it("Checks calling the method emits the log", async () => {
      const { deployProxy, admin, DummyImplementation } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      const methodSelector = DummyImplementation.interface.getFunction(variant.method).selector;
      await expect(dummy.connect(admin)[variant.method]()).to.emit(dummy, "MethodCalled").withArgs(methodSelector);
    });

    it("Checks calling the method emits the log [?isAMP2]", async () => {
      const { deployProxy, admin, DummyImplementation } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      const methodSelector = DummyImplementation.interface.getFunction("callThruAMPSkippedMethod").selector;
      await expect(dummy.connect(admin)["callThruAMPSkippedMethod"]())
        .to.emit(dummy, "MethodCalled")
        .withArgs(methodSelector);
    });
  });
});
