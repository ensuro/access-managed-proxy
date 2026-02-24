const { ethers } = require("ethers");

const PUBLIC_ROLE = 2n ** 64n - 1n;
const ADMIN_ROLE = 0n;

/**
 * Gets the ABI of a contract from Etherscan
 * @param {string} contractAddress - The contract address
 * @param {string} chainId - Chain ID (default: "1" )
 * @returns {Promise<Array>} The contract ABI
 */
async function getAbiFromEtherscan(contractAddress, chainId = "1") {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  const url = `https://api.etherscan.io/v2/api?module=contract&action=getabi&address=${contractAddress}&chainid=${chainId}&apikey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === "1" && data.result) {
    return JSON.parse(data.result);
  }

  throw new Error(`Failed to get ABI from Etherscan: ${data.message}`);
}

/**
 * Gets access control information for an AccessManagedProxy contract
 * @param contractAddress - The contract address
 * @param contractInterface - The interface of the implementation contract (to get function names)
 * @param opts - Object with some optional parameters:
 *                  acMgrContract: name of the AccessManager contract (default "AccessManager")
 *                  ampContract: name of the AccessManagedProxy contract (default "AccessManagedProxy")
 * @returns {Promise<Object>} Access control information
 */
async function getAccessControlInfo(hre, contractAddress, contractInterface, opts = {}) {
  const proxyContract = await hre.ethers.getContractAt(opts.ampContract || "AccessManagedProxy", contractAddress);

  const accessManager = await proxyContract.ACCESS_MANAGER();
  const passThruMethods = await proxyContract.PASS_THRU_METHODS();

  const accessManagerContract = await hre.ethers.getContractAt(opts.acMgrContract || "AccessManager", accessManager);

  const functions = contractInterface.fragments.filter((f) => f.type === "function");

  const roleNames = {};
  roleNames[PUBLIC_ROLE] = "PUBLIC_ROLE";
  roleNames[ADMIN_ROLE] = "ADMIN_ROLE";

  const labelEventFilter = accessManagerContract.filters.RoleLabel();
  for (const lblEvt of await accessManagerContract.queryFilter(labelEventFilter)) {
    roleNames[lblEvt.args.roleId] = lblEvt.args.label;
  }
  const rolesByMethod = [];

  const setTargetFunctionFilter = accessManagerContract.filters.TargetFunctionRoleUpdated(contractAddress);
  const rolesBySelector = Object.fromEntries(
    (await accessManagerContract.queryFilter(setTargetFunctionFilter)).map((evt) => [
      evt.args.selector,
      evt.args.roleId,
    ])
  );

  for (const func of functions) {
    const selector = func.selector;

    const roleId = rolesBySelector[selector] || ADMIN_ROLE;
    const roleName = roleNames[roleId] || `ROLE_${roleId.toString}`;

    rolesByMethod.push({
      selector: selector,
      method: func.name,
      fullMethod: func.format("minimal"),
      type: func.stateMutability,
      roleId: roleId,
      roleName: roleName,
      passThru: passThruMethods.includes(selector),
    });
  }

  const includedSelectors = new Set(rolesByMethod.map((x) => x.selector));

  // Check all granted methods are included in the output, even if they are not in the ABI
  for (const [selector, roleId] of Object.entries(rolesBySelector)) {
    if (includedSelectors.has(selector)) continue;
    const roleName = roleNames[roleId] || `ROLE_${roleId.toString}`;
    rolesByMethod.push({
      selector: selector,
      method: null,
      fullMethod: null,
      type: null,
      roleId: roleId,
      roleName: roleName,
      passThru: passThruMethods.includes(selector),
    });
    includedSelectors.add(selector);
  }
  // Complete with all the selectors that are in passThruMethods and not in the ABI nor in TargetFunctionRoleUpdated
  // events
  for (const selector of passThruMethods) {
    if (includedSelectors.has(selector)) continue;
    rolesByMethod.push({
      selector: selector,
      method: null,
      fullMethod: null,
      type: null,
      roleId: ADMIN_ROLE,
      roleName: roleNames[ADMIN_ROLE],
      passThru: true,
    });
    includedSelectors.add(selector);
  }

  return {
    ACCESS_MANAGER: accessManager,
    PASS_THRU_METHODS: passThruMethods,
    rolesByMethod: rolesByMethod,
  };
}

module.exports = { getAbiFromEtherscan, getAccessControlInfo };
