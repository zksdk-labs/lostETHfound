require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    hardhat: {
      // Default in-process network for testing
    },
    ...(process.env.SEPOLIA_RPC_URL && process.env.DEPLOYER_PRIVATE_KEY
      ? {
          sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [process.env.DEPLOYER_PRIVATE_KEY],
          },
        }
      : {}),
    ...(process.env.DEPLOYER_PRIVATE_KEY
      ? {
          baseSepolia: {
            url: "https://sepolia.base.org",
            accounts: [process.env.DEPLOYER_PRIVATE_KEY],
          },
        }
      : {}),
  },
};
