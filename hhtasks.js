const { task, types } = require("hardhat/config");
const { getAccessControlInfo } = require("./js/getAccessControlInfo");

function addTasks() {
  task("amp:getAccessControlInfo", "Gets access control information for an AccessManagedProxy contract")
    .addParam("contractAddress", "The contract address", undefined, types.address)
    .addOptionalParam("chainId", "Chain ID (default: 1)", "1", types.string)
    .setAction(async function (taskArgs) {
      const result = await getAccessControlInfo(taskArgs.contractAddress, taskArgs.chainId);
      
      console.log(JSON.stringify(result, null, 2));
    });
}

module.exports = {
  addTasks,
};

