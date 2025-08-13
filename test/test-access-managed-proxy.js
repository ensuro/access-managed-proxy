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

async function setUpAMPSkip(nMethods) {
  const ret = await setUpCommon();
  const { admin, AccessManager, DummyImplementation } = ret;
  const AccessManagedProxySkip = await ethers.getContractFactory(`AccessManagedProxyS${nMethods}`);
  const acMgr = await AccessManager.deploy(admin);
  const selector = DummyImplementation.interface.getFunction("callThruAMPSkippedMethod").selector;
  const selectors = [...Array(nMethods - 1).keys()].map(randomSelector);
  selectors.push(selector);

  async function deployProxy(implContract = DummyImplementation) {
    const ret = await hre.upgrades.deployProxy(implContract, [], {
      kind: "uups",
      unsafeAllow: [
        "delegatecall",
        "missing-initializer-call", // This is to fix an error because it says we are not calling
        // parent initializer
      ],
      proxyFactory: AccessManagedProxySkip,
      deployFunction: async (hre_, opts, factory, ...args) =>
        ozUpgradesDeploy(hre_, opts, factory, ...args, acMgr, selectors),
    });
    const retAsAMP = AccessManagedProxySkip.attach(ret);
    expect(await retAsAMP.PASS_THRU_METHODS()).to.deep.equal(selectors);
    return ret;
  }

  return {
    skipSelectors: selectors,
    acMgr,
    AccessManagedProxy: AccessManagedProxySkip,
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
  {
    name: "AccessManagedProxyS10",
    fixture: async () => setUpAMPSkip(10),
    method: "callThruAMPNonSkippedMethod",
    hasAC: true,
    hasSkippedMethod: true,
  },
  {
    name: "AccessManagedProxyS24",
    fixture: async () => setUpAMPSkip(24),
    method: "callThruAMPNonSkippedMethod",
    hasAC: true,
    hasSkippedMethod: true,
  },
  {
    name: "AccessManagedProxyS1",
    fixture: async () => setUpAMPSkip(1),
    method: "callThruAMPNonSkippedMethod",
    hasAC: true,
    hasSkippedMethod: true,
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

    it("Checks calling the skipped method with anon works [?hasSkippedMethod]", async () => {
      const { deployProxy, anon, DummyImplementation } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      const methodSelector = DummyImplementation.interface.getFunction("callThruAMPSkippedMethod").selector;
      await expect(dummy.connect(anon)["callThruAMPSkippedMethod"]())
        .to.emit(dummy, "MethodCalled")
        .withArgs(methodSelector);
    });

    it("Checks skipped methods are observable calling PASS_THRU_METHODS [?hasSkippedMethod]", async () => {
      const { deployProxy, skipSelectors, AccessManagedProxy } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      const dummyAsAMP = AccessManagedProxy.attach(dummy);
      expect(await dummyAsAMP.PASS_THRU_METHODS()).to.deep.equal(skipSelectors);
    });
  });
});
