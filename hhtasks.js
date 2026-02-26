const fs = require("fs");
const { task, types } = require("hardhat/config");
const { readImplementationAddress } = require("@ensuro/utils/js/utils");
const { getAccessControlInfo, getAbiFromEtherscan } = require("./js/getAccessControlInfo");

function writeToCSVOutput(accessControlInfo) {
  // Just methods in the output
  let ret = "selector,method,type,isPassThru,roleId,roleName\n";

  const countByMethod = accessControlInfo.rolesByMethod.reduce((methodCounter, item) => {
    methodCounter[item.method] = (methodCounter[item.method] || 0) + 1;
    return methodCounter;
  }, {});

  for (methodACI of accessControlInfo.rolesByMethod) {
    const methodCol =
      methodACI.method === null
        ? "<unknown>"
        : countByMethod[methodACI.method] == 1
          ? methodACI.method
          : methodACI.fullMethod.replace(/^function /, "");
    const columns = [
      methodACI.selector,
      `"${methodCol}"`,
      methodACI.type || "<unknown>",
      methodACI.passThru ? "true" : "false",
      `"${methodACI.roleId.toString()}"`,
      `"${methodACI.roleName}"`,
    ];
    ret += columns.join(",") + "\n";
  }
  return ret;
}

function writeToJSONOutput(accessControlInfo) {
  return JSON.stringify(accessControlInfo, (_, v) => (typeof v == "bigint" ? v.toString() : v), 2);
}

function addTasks() {
  task("amp:getAccessControlInfo", "Gets access control information for an AccessManagedProxy contract")
    .addParam("contractAddress", "The contract address", undefined, types.address)
    .addOptionalParam(
      "contractFactory",
      "Contract Factory (to get the interface, otherwise, fetch from etherscan)",
      undefined,
      types.string
    )
    .addOptionalParam("chainId", "Chain ID (default: guess from network)", undefined, types.number)
    .addOptionalParam("format", "Output format", "csv", types.string)
    .addOptionalParam("output", "Output file", "-", types.string)
    .setAction(async function (taskArgs) {
      let contractInterface;
      if (taskArgs.contractFactory === undefined) {
        // Get the ABI from Etherscan
        const implementationAddr = await readImplementationAddress(hre, taskArgs.contractAddress);
        let chainId = taskArgs.chainId;
        if (chainId === undefined) {
          chainId = parseInt(await hre.network.provider.send("eth_chainId"));
        }
        const apiKey = process.env.ETHERSCAN_API_KEY || "";
        const ABI = await getAbiFromEtherscan(implementationAddr, chainId, apiKey);
        contractInterface = new ethers.Interface(ABI);
      } else {
        const factory = await ethers.getContractFactory(taskArgs.contractFactory);
        contractInterface = factory.interface;
      }
      const result = await getAccessControlInfo(hre, taskArgs.contractAddress, contractInterface);
      const formatFunction = {
        csv: writeToCSVOutput,
        json: writeToJSONOutput,
      }[taskArgs.format];
      const output = formatFunction(result);
      if (taskArgs.output === "-") {
        console.log(output);
      } else {
        fs.writeFileSync(taskArgs.output, output);
      }
    });
}

module.exports = {
  addTasks,
};
