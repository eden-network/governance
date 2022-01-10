module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const token = await get("EdenToken");
  const edenNetworkProxy = await get("EdenNetworkProxy")
  const { readUpdatersFromFile } = require('../scripts/readUpdatersFromFile')
  const updaters = []
  const slashers = []
  const updatersMapping = readUpdatersFromFile()
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS
  const DISTRIBUTOR_UPDATE_THRESHOLD = process.env.DISTRIBUTOR_UPDATE_THRESHOLD

  for(const [updater, isSlasher] of Object.entries(updatersMapping)) {
      updaters.push(updater)
      if(isSlasher) {
          slashers.push(updater)
      }
  }

  log("19) Deploy MerkleDistributorSEV");
  const deployResult = await deploy("MerkleDistributorSEV", {
      from: deployer,
      contract: "MerkleDistributorSEV",
      args: [token.address, edenNetworkProxy.address, ADMIN_ADDRESS, DISTRIBUTOR_UPDATE_THRESHOLD, updaters, slashers],
      skipIfAlreadyDeployed: false,
      log: true
  });

  if (deployResult.newlyDeployed) {
      log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
  } else {
      log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
  }
};

module.exports.tags = ["19", "MerkleDistributorSEV"]
module.exports.dependencies = ["18"]