require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require('hardhat-abi-exporter');
require('hardhat-log-remover');
require("@tenderly/hardhat-tenderly");
require("hardhat-gas-reporter");

const { rewardScheduleEncoder, makeRewardSchedule }  = require('./scripts/utils/rewardScheduleEncoder');

const dotenv = require("dotenv");
dotenv.config();

const INFURA_KEY = process.env.INFURA_KEY
const FORK_URL = process.env.FORK_URL
const FORK_BLOCK_NUMBER = process.env.FORK_BLOCK_NUMBER
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY
const TENDERLY_USERNAME = process.env.TENDERLY_USERNAME
const TENDERLY_PROJECT_NAME = process.env.TENDERLY_PROJECT_NAME
const REPORT_GAS = process.env.REPORT_GAS
const CMC_API_KEY = process.env.CMC_API_KEY

// Default Hardhat network config
let hardhatConfig = {
  live: false,
  saveDeployments: true,
  tags: ["test"]
}

let localhostConfig = {
  url: 'http://localhost:8545',
  live: false,
  saveDeployments: true,
  tags: ["local"]
}

// If FORK_URL env var is set, enable forking on Hardhat network
// Documentation: https://hardhat.org/hardhat-network/#mainnet-forking
if (FORK_URL && FORK_URL.length > 0) {
  hardhatConfig.forking = {}
  hardhatConfig.forking.url = FORK_URL
  hardhatConfig.tags.push("dev")
  localhostConfig.chainId = 1
  localhostConfig.forking = {}
  localhostConfig.forking.url = FORK_URL
  localhostConfig.tags.push("dev")
  // If FORK_BLOCK_NUMBER env var is set, create fork from specific block
  if (FORK_BLOCK_NUMBER && parseInt(FORK_BLOCK_NUMBER)) {
    hardhatConfig.forking.blockNumber = parseInt(FORK_BLOCK_NUMBER)
    localhostConfig.forking.blockNumber = parseInt(FORK_BLOCK_NUMBER)
  }
} else {
  hardhatConfig.tags.push("local")
}

let rinkebyConfig = {
  url: "https://rinkeby.infura.io/v3/" + INFURA_KEY,
  chainId: 4,
  live: true,
  saveDeployments: true,
  tags: ["staging"],
}

let ropstenConfig = {
  url: "https://ropsten.infura.io/v3/" + INFURA_KEY,
  chainId: 3,
  live: true,
  saveDeployments: true,
  tags: ["staging"],
}

let mainnetConfig = {
  url: "https://mainnet.infura.io/v3/" + INFURA_KEY,
  chainId: 1,
  live: true,
  saveDeployments: true,
  tags: ["prod", "mainnet", "live"]
}

if (DEPLOYER_PRIVATE_KEY && DEPLOYER_PRIVATE_KEY.length > 0) {
  // localhostConfig.accounts = [DEPLOYER_PRIVATE_KEY]
  ropstenConfig.accounts = [DEPLOYER_PRIVATE_KEY]
  rinkebyConfig.accounts = [DEPLOYER_PRIVATE_KEY]
  mainnetConfig.accounts = [DEPLOYER_PRIVATE_KEY]
  if (ADMIN_PRIVATE_KEY && ADMIN_PRIVATE_KEY.length > 0) {
    // localhostConfig.accounts.push(ADMIN_PRIVATE_KEY)
    ropstenConfig.accounts.push(ADMIN_PRIVATE_KEY)
    rinkebyConfig.accounts.push(ADMIN_PRIVATE_KEY)
  }
}


// Hardhat tasks
// Documentation: https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("start-rewards", "start reward schedule")
    .addParam("startTime", "uint256", undefined, undefined, true)
    .addParam("scaleFactor", "number", undefined, undefined, true)
    .setAction(async (args, hre) => {
        const account = (await hre.getNamedAccounts())['admin'];
        const contract = await hre.ethers.getContract("DistributorGovernance", account);
        const schedule = rewardScheduleEncoder(
            makeRewardSchedule(
                Number(args.startTime === undefined ? Math.floor(Date.now() / 1000) : startTime),
                Number(args.scaleFactor === undefined ? 1 : args.scaleFactor)
        ));
        const tx = await contract.setRewardSchedule(schedule);
        console.log(tx.hash);
    });

// Hardhat Config
// Documentation: https://hardhat.org/config/
// Deploy add-ons: https://hardhat.org/plugins/hardhat-deploy.html
module.exports = {
  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999
      }
    }
  },
  mocha: {
    timeout: 350000
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: hardhatConfig,
    localhost: localhostConfig,
    rinkeby: rinkebyConfig,
    ropsten: ropstenConfig,
    mainnet: mainnetConfig
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  namedAccounts: {
    deployer: {
      default: 0,
      1: DEPLOYER_ADDRESS,
      3: DEPLOYER_ADDRESS
    },
    admin: {
      default: 1,
      1: ADMIN_ADDRESS,
      3: ADMIN_ADDRESS
    }
  },
  paths: {
    deploy: 'deploy',
    deployments: 'deployments',
    imports: `imports`
  },
  abiExporter: {
    path: './abis',
    clear: true,
    flat: true,
    except: ["interfaces"]
  },
  tenderly: {
    username: TENDERLY_USERNAME,
    project: TENDERLY_PROJECT_NAME
  },
  gasReporter: {
    enabled: REPORT_GAS && REPORT_GAS == "true" ? true : false,
    coinmarketcap: CMC_API_KEY,
    currency: 'USD',
    showTimeSpent: true
  }
};