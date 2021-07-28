module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log("12) SlotMarket");
    const deployResult = await deploy("SlotMarket", {
        from: deployer,
        contract: "SlotMarket",
        skipIfAlreadyDeployed: true,
        log: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["12", "SlotMarket"]
module.exports.dependencies = ["11"]
