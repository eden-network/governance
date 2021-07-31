module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log, get } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    const token = await get("EdenToken");
    const governance = await get("DistributorGovernance")
    const { readUpdatersFromFile } = require('../scripts/readUpdatersFromFile')
    const updaters = []
    const slashers = []
    const updatersMapping = readUpdatersFromFile()
    const DISTRIBUTOR_UPDATE_THRESHOLD = process.env.DISTRIBUTOR_UPDATE_THRESHOLD

    for((updater, isSlasher) of Object.entries(updatersMapping)) {
        updaters.push(updater)
        if(isSlasher) {
            slashers.push(updater)
        }
    }

    log("11) Deploy MerkleDistributor");
    const deployResult = await deploy("MerkleDistributor", {
        from: deployer,
        contract: "MerkleDistributor",
        args: [token.address, governance.address, admin, DISTRIBUTOR_UPDATE_THRESHOLD, updaters, slashers],
        skipIfAlreadyDeployed: true,
        log: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["11", "MerkleDistributor"]
module.exports.dependencies = ["10"]