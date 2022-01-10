module.exports = async ({ ethers, getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const TAX_NUMERATOR = process.env.TAX_NUMERATOR
  const TAX_DENOMINATOR = process.env.TAX_DENOMINATOR
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS
  const token = await deployments.get("EdenToken")
  const lockManager = await deployments.get("LockManager")
  const edenNetwork = await deployments.get("EdenNetwork")
  const edenNetworkManager = await deployments.get("EdenNetworkManager")
  const edenNetworkInterface = new ethers.utils.Interface(edenNetwork.abi);
  const initData = edenNetworkInterface.encodeFunctionData("initialize", [
      token.address,
      lockManager.address,
      ADMIN_ADDRESS,
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

module.exports.skip = async function({ deployments }) {
  const edenNetworkProxy = await deployments.get("EdenNetworkProxy")
  const { log } = deployments;
  if(edenNetworkProxy && edenNetworkProxy.address) {
    log(`14) EdenNetworkProxy`)
    log(`- Skipping step, proxy has already been deployed`)
    return true
  } else {
    return false
  }
}

module.exports.tags = ["14", "EdenNetworkProxy"]
module.exports.dependencies = ["13"]