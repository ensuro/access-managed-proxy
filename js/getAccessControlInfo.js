const { ethers } = require("ethers");

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

function getProvider() {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL environment variable is required");
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

function getContract(contractAddress, abi) {
  const provider = getProvider();
  return new ethers.Contract(contractAddress, abi, provider);
}

/**
 * Gets the implementation address from an ERC1967 proxy
 * @param {string} proxyAddress - The proxy contract address
 * @returns {Promise<string>} The implementation contract address
 */
async function getImplementationAddress(proxyAddress) {
  const provider = getProvider();
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implementationSlotValue = await provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  return ethers.getAddress("0x" + implementationSlotValue.slice(-40));
}

/**
 * Gets access control information for an AccessManagedProxy contract
 * @param {string} contractAddress - The contract address
 * @param {string} chainId - Chain ID (default: "1")
 * @returns {Promise<Object>} Access control information
 */
async function getAccessControlInfo(contractAddress, chainId = "1") {
  const proxyAbi = await getAbiFromEtherscan(contractAddress, chainId);
  const proxyContract = getContract(contractAddress, proxyAbi);
  
  const accessManager = await proxyContract.ACCESS_MANAGER();
  const passThruMethods = await proxyContract.PASS_THRU_METHODS();
  
  const implementationAddress = await getImplementationAddress(contractAddress);
  
  const implementationAbi = await getAbiFromEtherscan(implementationAddress, chainId);
  
  const accessManagerAbi = await getAbiFromEtherscan(accessManager, chainId);
  const accessManagerContract = getContract(accessManager, accessManagerAbi);
  
  const interface = new ethers.Interface(implementationAbi);
  const functions = interface.fragments.filter((f) => f.type === "function");
  
  const PUBLIC_ROLE = await accessManagerContract.PUBLIC_ROLE();
  const ADMIN_ROLE = await accessManagerContract.ADMIN_ROLE();
  
  const rolesByMethod = [];
  
  for (const func of functions) {
    const selector = func.selector;
    const isPassThru = passThruMethods.includes(selector);
    
    let roleId = null;
    let roleName = null;
    
    if (!isPassThru) {
      try {
        roleId = await accessManagerContract.getTargetFunctionRole(contractAddress, selector);
        
        if (roleId === PUBLIC_ROLE) {
          roleName = "PUBLIC_ROLE";
        } else if (roleId === ADMIN_ROLE) {
          roleName = "ADMIN_ROLE";
        } else {
          roleName = `ROLE_${roleId.toString()}`;
        }
      } catch (error) {
        console.warn(`Could not get role for selector ${selector}: ${error.message}`);
      }
    }
    
    rolesByMethod.push({
      selector: selector,
      method: func.name,
      fullMethod: func.format("full"),
      type: func.stateMutability,
      role_id: roleId !== null && roleId !== undefined ? roleId.toString() : null,
      role_name: roleName,
      pass_thru: isPassThru
    });
  }
  
  return {
    ACCESS_MANAGER: accessManager,
    PASS_THRU_METHODS: passThruMethods,
    roles_by_method: rolesByMethod
  };
}

module.exports = { getContract, getAbiFromEtherscan, getAccessControlInfo, getImplementationAddress };
