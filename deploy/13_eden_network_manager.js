module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  
  log(`13) EdenNetworkManager`)
  // Deploy EdenNetworkManager contract
  const deployResult = await deploy("EdenNetworkManager", {
    from: deployer,
    contract: "EdenNetworkManager",
    gas: 4000000,
    skipIfAlreadyDeployed: true
  });

  if (deployResult.newlyDeployed) {
    log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
  } else {
    log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
  }
};

module.exports.tags = ["13", "EdenNetworkManager"]
module.exports.dependencies = ["12"]