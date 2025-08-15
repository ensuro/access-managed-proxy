require("@openzeppelin/hardhat-upgrades");
require("hardhat-dependency-compiler");
require("hardhat-contract-sizer");
require("hardhat-ignore-warnings");
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
  dependencyCompiler: {
    paths: ["@openzeppelin/contracts/access/manager/AccessManager.sol"],
  },
  warnings: {
    "contracts/AccessManagedProxy.sol": {
      "missing-receive": "off",
      "unused-param": "off",
    },
    "contracts/amps/AccessManagedProxyS*.sol": {
      "missing-receive": "off",
      "unused-param": "off",
    },
  },
};
