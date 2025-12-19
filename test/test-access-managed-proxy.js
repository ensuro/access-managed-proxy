const { expect } = require("chai");

const hre = require("hardhat");
const { ethers } = hre;
const { tagitVariant, setupAMRole, captureAny } = require("@ensuro/utils/js/utils");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { deployAMPProxy, attachAsAMP } = require("../js/deployProxy");
const { ZeroAddress } = ethers;

async function setUpCommon() {
  const [admin, anon] = await ethers.getSigners();
  const DummyImplementation = await ethers.getContractFactory("DummyImplementation");
  const DummyAccessManaged = await ethers.getContractFactory("DummyAccessManaged");
  const AccessManager = await ethers.getContractFactory("AccessManager");

  return {
    admin,
    anon,
    AccessManager,
    DummyAccessManaged,
    DummyImplementation,
  };
}

async function setUpAMP() {
  const ret = await setUpCommon();
  const AccessManagedProxy = await ethers.getContractFactory("AccessManagedProxy");
  const { admin, AccessManager, DummyImplementation } = ret;
  const acMgr = await AccessManager.deploy(admin);

  async function deployProxy() {
    return deployAMPProxy(DummyImplementation, [], { acMgr });
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

async function setUpAMPSkip(nMethods, skipViewsAndPure = false) {
  const ret = await setUpCommon();
  const { admin, AccessManager, DummyImplementation } = ret;
  const AccessManagedProxy = await ethers.getContractFactory("AccessManagedProxy");
  const acMgr = await AccessManager.deploy(admin);
  const selector = DummyImplementation.interface.getFunction("callThruAMPSkippedMethod").selector;
  const selectors = [...Array(nMethods - 1).keys()].map(randomSelector);
  selectors.push(selector);

  async function deployProxy() {
    return deployAMPProxy(DummyImplementation, [], { acMgr, skipMethods: selectors, skipViewsAndPure });
  }

  return {
    skipSelectors: selectors,
    acMgr,
    AccessManagedProxy,
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

async function setUpDummyAccessManaged() {
  const ret = await setUpCommon();
  const { admin, AccessManager } = ret;
  const acMgr = await AccessManager.deploy(admin);

  async function deployProxy(implContract = ret.DummyAccessManaged) {
    const contract = await hre.upgrades.deployProxy(implContract, [await ethers.resolveAddress(acMgr)], {
      kind: "uups",
    });
    // Make the method public
    // const PUBLIC_ROLE = await acMgr.PUBLIC_ROLE();
    // const selector = ret.DummyAccessManaged.interface.getFunction("callThruAMP").selector;
    // await acMgr.setTargetFunctionRole(contract, [selector], PUBLIC_ROLE);
    return contract;
  }

  return {
    acMgr,
    deployProxy,
    ...ret,
  };
}

const variants = [
  { name: "NoProxy", fixture: setUpDirect, method: "callDirect", hasAC: false },
  { name: "ERC1967Proxy", fixture: setUpERC1967, method: "callThru1967", hasAC: false },
  { name: "DummyAccessManaged", fixture: setUpDummyAccessManaged, method: "callThruAMP", hasAC: false },
  { name: "AccessManagedProxy", fixture: setUpAMP, method: "callThruAMP", hasAC: true },
  {
    name: "AccessManagedProxyMS40",
    fixture: async () => setUpAMPSkip(40),
    method: "callThruAMPNonSkippedMethod",
    hasAC: true,
    hasSkippedMethod: true,
  },
  {
    name: "AccessManagedProxyMS1-skipViews",
    fixture: async () => setUpAMPSkip(1, true),
    method: "callThruAMPNonSkippedMethod",
    hasAC: true,
    hasSkippedMethod: true,
    hasViews: true,
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

    it("Checks events are emmited on proxy deployment [?hasAC]", async () => {
      const { acMgr, deployProxy } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      const dummyAsAMP = await ethers.getContractAt("AccessManagedProxy", await ethers.resolveAddress(dummy));
      const ptMethods = await dummyAsAMP.PASS_THRU_METHODS();
      await expect(dummy.deploymentTransaction())
        .to.emit(dummyAsAMP, "AuthorityUpdated")
        .withArgs(acMgr)
        .to.emit(dummyAsAMP, "PassThruMethodsChanged")
        .withArgs(ptMethods);
    });

    it("Checks it can change the AccessManager [?hasAC]", async () => {
      const { acMgr, admin, anon, deployProxy, AccessManager } = await helpers.loadFixture(variant.fixture);
      const newAcMgr = await AccessManager.deploy(anon);
      const dummy = await deployProxy();
      const dummyAsAMP = await ethers.getContractAt("AccessManagedProxy", await ethers.resolveAddress(dummy));

      expect(await dummyAsAMP.authority()).to.equal(acMgr);
      expect(await dummyAsAMP.ACCESS_MANAGER()).to.equal(acMgr);

      // It doesn't accept address(0)
      await expect(dummy.setAuthority(ZeroAddress))
        .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedInvalidAuthority")
        .withArgs(ZeroAddress);

      // It doesn't accept an EOA
      await expect(dummy.setAuthority(anon))
        .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedInvalidAuthority")
        .withArgs(anon);

      await expect(dummy.setAuthority(newAcMgr)).to.emit(dummyAsAMP, "AuthorityUpdated").withArgs(newAcMgr);
      expect(await dummyAsAMP.connect(admin).authority()).to.equal(newAcMgr);
      expect(await dummyAsAMP.connect(admin).ACCESS_MANAGER()).to.equal(newAcMgr);

      // Now the old admin can't access permissioned methods
      await expect(dummy.connect(admin).setAuthority(newAcMgr)).to.be.revertedWithCustomError(
        dummyAsAMP,
        "AccessManagedUnauthorized"
      );

      // But the new admin (anon) can
      await expect(dummy.connect(anon).setAuthority(newAcMgr)).not.to.be.reverted;
    });

    it("Checks it can change the passThruMethods [?hasAC]", async () => {
      const { admin, anon, deployProxy, DummyImplementation } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      const dummyAsAMP = await ethers.getContractAt("AccessManagedProxy", await ethers.resolveAddress(dummy));

      const newSkipMethods = [DummyImplementation.interface.getFunction("setPassThruMethods").selector];
      await expect(dummy.connect(anon).setPassThruMethods(newSkipMethods)).to.be.revertedWithCustomError(
        dummyAsAMP,
        "AccessManagedUnauthorized"
      );

      await expect(dummy.connect(admin).setPassThruMethods(newSkipMethods))
        .to.emit(dummyAsAMP, "PassThruMethodsChanged")
        .withArgs(newSkipMethods);

      expect(await dummyAsAMP.connect(admin).PASS_THRU_METHODS()).to.deep.equal(newSkipMethods);

      // Now the anon can setPassThruMethods because is skipped
      await expect(dummy.connect(anon).setPassThruMethods([]))
        .to.emit(dummyAsAMP, "PassThruMethodsChanged")
        .withArgs([]);
      // Now it can't anymore
      await expect(dummy.connect(anon).setPassThruMethods(newSkipMethods)).to.be.revertedWithCustomError(
        dummyAsAMP,
        "AccessManagedUnauthorized"
      );
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
      const { deployProxy, skipSelectors, AccessManagedProxy, DummyImplementation } = await helpers.loadFixture(
        variant.fixture
      );
      const dummy = await deployProxy();
      const dummyAsAMP = AccessManagedProxy.attach(dummy);
      if (variant.hasViews) {
        const expectedSelectors = ["UPGRADE_INTERFACE_VERSION", "proxiableUUID", "pureMethod", "viewMethod"]
          .map((methodName) => DummyImplementation.interface.getFunction(methodName).selector)
          .concat(skipSelectors);
        expect(await dummyAsAMP.PASS_THRU_METHODS()).to.deep.equal(expectedSelectors);
      } else {
        expect(await dummyAsAMP.PASS_THRU_METHODS()).to.deep.equal(skipSelectors);
      }
    });

    it("Checks access to views [?hasAC]", async () => {
      const { deployProxy, anon } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      if (variant.hasViews) {
        expect(await dummy.connect(anon).viewMethod()).to.equal(anon);
        expect(await dummy.connect(anon).pureMethod()).to.equal(123456n);
      } else {
        const dummyAsAMP = await attachAsAMP(dummy);
        await expect(dummy.connect(anon).viewMethod())
          .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedUnauthorized")
          .withArgs(anon);
        await expect(dummy.connect(anon).pureMethod())
          .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedUnauthorized")
          .withArgs(anon);
      }
    });

    it("Checks custom selectors can be checked from implementation class [?hasAC]", async () => {
      const { deployProxy, anon, admin, DummyImplementation, acMgr } = await helpers.loadFixture(variant.fixture);
      const dummy = await deployProxy();
      const dummyAsAMP = await attachAsAMP(dummy);

      // Anon can't call because it doesn't have permission to call `checkCanCall`
      await expect(dummy.connect(anon).checkCanCall(ethers.toUtf8Bytes("foobar")))
        .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedUnauthorized")
        .withArgs(anon);

      // Make "checkCanCall" PUBLIC_ROLE
      await acMgr
        .connect(admin)
        .setTargetFunctionRole(
          dummy,
          [DummyImplementation.interface.getFunction("checkCanCall").selector],
          await acMgr.PUBLIC_ROLE()
        );

      // Anon still fails because it doesn't have the custom permission
      await expect(dummy.connect(anon).checkCanCall(ethers.toUtf8Bytes("foobar")))
        .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedUnauthorized")
        .withArgs(anon);

      await expect(dummy.connect(admin).checkCanCall(ethers.toUtf8Bytes("foobar")))
        .to.emit(dummy, "MethodCalled")
        .withArgs(captureAny.value);
      const selector = captureAny.lastValue;

      expect(selector).to.equal(ethers.keccak256(ethers.toUtf8Bytes("foobar")).slice(0, 10));

      // Make custom "foobar" selector enabled for anon
      await acMgr.grantRole(234, anon, 0);
      await acMgr.connect(admin).setTargetFunctionRole(dummy, [selector], 234);

      // Now anon works fine
      await expect(dummy.connect(anon).checkCanCall(ethers.toUtf8Bytes("foobar"))).not.to.be.reverted;
      // Now admin fails
      await expect(dummy.connect(admin).checkCanCall(ethers.toUtf8Bytes("foobar")))
        .to.be.revertedWithCustomError(dummyAsAMP, "AccessManagedUnauthorized")
        .withArgs(admin);
    });
  });
});
