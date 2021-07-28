module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  
  log(`13) SlotMarketManager`)
  // Deploy SlotMarketManager contract
  const deployResult = await deploy("SlotMarketManager", {
    from: deployer,
    contract: "SlotMarketManager",
    gas: 4000000,
    skipIfAlreadyDeployed: true
  });

  if (deployResult.newlyDeployed) {
    log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
  } else {
    log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
  }
};

module.exports.tags = ["13", "SlotMarketManager"]
module.exports.dependencies = ["12"]