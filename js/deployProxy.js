const hre = require("hardhat");
const { ethers } = hre;
const { deploy: ozUpgradesDeploy } = require("@openzeppelin/hardhat-upgrades/dist/utils");

/**
 * Deploys a contract using an AccessManagedProxy. Similar to hre.upgrades.deployProxy, but using AccessManagedProxy
 *
 * @param {contractFactory} The contract factory of the implementation contract
 * @param {initializeArgs} Arguments for `initialize`
 * @param {opts} Options for hre.upgrades.deployProxy with some AccessManagedProxy additions:
 *               - skipViewsAndPure: if true, deploys a proxy that will skip the access control for all the view and
 *                                   pure methods
 *               - skipMethods: list of method names that will skip the access control. Added to views and pure, if
 *                              skipViewsAndPure is true.
 *               - acMgr: mandatory argument that will be used for the AMP
 * @returns {contract} Promise<Contract>
 */
async function deployAMPProxy(contractFactory, initializeArgs = [], opts = {}) {
  const { acMgr, skipViewsAndPure, skipMethods } = opts;
  if (acMgr === undefined) throw new Error("Missing required `acMgr` in opts");
  let skipSelectors = [];
  if (skipViewsAndPure) {
    skipSelectors = contractFactory.interface.fragments
      .filter(
        (fragment) =>
          fragment.type === "function" && (fragment.stateMutability === "pure" || fragment.stateMutability === "view")
      )
      .map((fragment) => fragment.selector);
  }
  if (skipMethods !== undefined && skipMethods.length > 0) {
    skipSelectors.push(
      ...skipMethods.map((method) =>
        method.startsWith("0x") ? method : contractFactory.interface.getFunction(method).selector
      )
    );
  }
  let proxyFactory, deployFunction;
  if (skipSelectors.length > 0) {
    proxyFactory = await ethers.getContractFactory(`AccessManagedProxyS${skipSelectors.length}`);
    deployFunction = async (hre_, opts, factory, ...args) =>
      ozUpgradesDeploy(hre_, opts, factory, ...args, acMgr, skipSelectors);
  } else {
    proxyFactory = await ethers.getContractFactory("AccessManagedProxy");
    deployFunction = async (hre_, opts, factory, ...args) => ozUpgradesDeploy(hre_, opts, factory, ...args, acMgr);
  }

  return hre.upgrades.deployProxy(contractFactory, initializeArgs, {
    ...opts,
    kind: "uups",
    proxyFactory,
    deployFunction,
  });
}

async function attachAsAMP(contract, ampContractFactory = undefined) {
  ampContractFactory = ampContractFactory || (await ethers.getContractFactory("AccessManagedProxyS1"));
  return ampContractFactory.attach(contract);
}

async function getAccessManager(contract, ampContractFactory = undefined, accessManagerFactory="AccessManager") {
  const contractAsAMP = await attachAsAMP(contract, ampContractFactory);
  return ethers.getContractAt(accessManagerFactory, await contractAsAMP.ACCESS_MANAGER());
}

function makeSelector(role) {
  return ethers.keccak256(ethers.toUtf8Bytes(role)).slice(0, 10);
}


module.exports = {
  deployAMPProxy,
  attachAsAMP,
  getAccessManager,
  makeSelector,
};
