module.exports = async ({ ethers, getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer, admin } = await getNamedAccounts();
  const TAX_NUMERATOR = process.env.TAX_NUMERATOR
  const TAX_DENOMINATOR = process.env.TAX_DENOMINATOR
  const token = await deployments.get("EdenToken")
  const lockManager = await deployments.get("LockManager")
  const edenNetwork = await deployments.get("EdenNetwork")
  const edenNetworkManager = await deployments.get("EdenNetworkManager")
  const edenNetworkInterface = new ethers.utils.Interface(edenNetwork.abi);
  const initData = edenNetworkInterface.encodeFunctionData("initialize", [
      token.address,
      lockManager.address,
      admin,
      TAX_NUMERATOR,
      TAX_DENOMINATOR
    ]
  );

  log(`14) EdenNetworkProxy`)
  // Deploy EdenNetworkProxy contract
  const deployResult = await deploy("EdenNetworkProxy", {
    from: deployer,
    contract: "EdenNetworkProxy",
    gas: 4000000,
    args: [edenNetwork.address, edenNetworkManager.address, initData],
    skipIfAlreadyDeployed: true,
    deterministicDeployment: token.address
  });

  if (deployResult.newlyDeployed) {
    log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
  } else {
    log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
  }
};

module.exports.tags = ["14", "EdenNetworkProxy"]
module.exports.dependencies = ["13"]