module.exports = async ({ ethers, getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer, admin } = await getNamedAccounts();
  const TAX_NUMERATOR = process.env.TAX_NUMERATOR
  const TAX_DENOMINATOR = process.env.TAX_DENOMINATOR
  const token = await deployments.get("EdenToken");
  const slotMarket = await deployments.get("SlotMarket")
  const slotMarketManager = await deployments.get("SlotMarketManager")
  const slotMarketInterface = new ethers.utils.Interface(slotMarket.abi);
  const initData = slotMarketInterface.encodeFunctionData("initialize", [
      token.address,
      admin,
      TAX_NUMERATOR,
      TAX_DENOMINATOR
    ]
  );

  log(`14) SlotMarketProxy`)
  // Deploy SlotMarketProxy contract
  const deployResult = await deploy("SlotMarketProxy", {
    from: deployer,
    contract: "SlotMarketProxy",
    gas: 4000000,
    args: [slotMarket.address, slotMarketManager.address, initData],
    skipIfAlreadyDeployed: true
  });

  if (deployResult.newlyDeployed) {
    log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
  } else {
    log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
  }
};

module.exports.tags = ["14", "SlotMarketProxy"]
module.exports.dependencies = ["13"]