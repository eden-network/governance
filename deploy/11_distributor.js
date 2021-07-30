module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log, get } = deployments;

    const { deployer, admin } = await getNamedAccounts();
    const token = await get("EdenToken");
    const governance = await get("DistributorGovernance")
    const DISTRIBUTOR_UPDATE_THRESHOLD = process.env.DISTRIBUTOR_UPDATE_THRESHOLD


    log("11) Deploy MerkleDistributor");
    const deployResult = await deploy("MerkleDistributor", {
        from: deployer,
        contract: "MerkleDistributor",
        args: [token.address, governance.address, admin, DISTRIBUTOR_UPDATE_THRESHOLD],
        skipIfAlreadyDeployed: true,
        log: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["11", "Distributor"]
module.exports.dependencies = ["10"]