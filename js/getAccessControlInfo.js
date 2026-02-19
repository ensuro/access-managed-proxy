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

function getContract(contractAddress, abi) {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL environment variable is required");
  }
  
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(contractAddress, abi, provider);
}

/**
 * Gets access control information for an AccessManagedProxy contract
 * @param {string} contractAddress - The contract address
 * @param {string} chainId - Chain ID (default: "1")
 * @returns {Promise<Object>} Access control information
 */
async function getAccessControlInfo(contractAddress, chainId = "1") {
  const abi = await getAbiFromEtherscan(contractAddress, chainId);
  
  const contract = getContract(contractAddress, abi);
  
  const accessManager = await contract.ACCESS_MANAGER();
  
  const passThruMethods = await contract.PASS_THRU_METHODS();
  
  const accessManagerAbi = await getAbiFromEtherscan(accessManager, chainId);
  const accessManagerContract = getContract(accessManager, accessManagerAbi);
  
  const interface = new ethers.Interface(abi);
  const functions = interface.fragments.filter((f) => f.type === "function");
  
  const rolesByMethod = [];
  
  for (const func of functions) {
    const selector = func.selector;
    const isPassThru = passThruMethods.includes(selector);
    
    let roleId = null;
    let roleName = null;
    
    if (!isPassThru) {
      try {
        const eventFilter = accessManagerContract.filters.TargetFunctionRoleUpdated(contractAddress, selector);
        const events = await accessManagerContract.queryFilter(eventFilter);
        
        if (events.length > 0) {
          const latestEvent = events[events.length - 1];
          roleId = latestEvent.args.roleId;
          
          const PUBLIC_ROLE = await accessManagerContract.PUBLIC_ROLE();
          const ADMIN_ROLE = await accessManagerContract.ADMIN_ROLE();
          
          if (PUBLIC_ROLE && roleId === PUBLIC_ROLE) {
            roleName = "PUBLIC_ROLE";
          } else if (ADMIN_ROLE && roleId === ADMIN_ROLE) {
            roleName = "ADMIN_ROLE";
          } else {
            roleName = `ROLE_${roleId.toString()}`;
          }
        }
      } catch (error) {
        console.warn(`Could not get role for selector ${selector}: ${error.message}`);
      }
    }
    
    rolesByMethod.push({
      selector: selector,
      method: func.name,
      fullMethod: func.format("full"),
      role_id: roleId ? roleId.toString() : null,
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

module.exports = { getContract, getAbiFromEtherscan, getAccessControlInfo };
