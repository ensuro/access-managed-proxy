require("@openzeppelin/hardhat-upgrades");
require("hardhat-dependency-compiler");
require("hardhat-contract-sizer");
require("hardhat-ignore-warnings");
require("@nomicfoundation/hardhat-toolbox");

const hhtasks = require("./hhtasks");
hhtasks.addTasks();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    sepolia: {
      url: process.env.RPC_URL_SEPOLIA || process.env.RPC_URL || "",
      chainId: 11155111,
    },
    mainnet: {
      url: process.env.RPC_URL_MAINNET || process.env.RPC_URL || "",
      chainId: 1,
    },
    polygon: {
      url: process.env.RPC_URL_POLYGON || process.env.RPC_URL || "",
      chainId: 137,
    },
    auto: {
      url: process.env.RPC_URL || "",
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
    "contracts/AccessManagedProxyBase.sol": {
      "missing-receive": "off",
    },
    "contracts/AccessManagedProxy.sol": {
      "missing-receive": "off",
    },
  },
};
