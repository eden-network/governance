module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const { readProducersFromFile } = require('../scripts/readProducersFromFile')
    const producersMapping = readProducersFromFile()
    const producers = Object.keys(producersMapping)
    const collectors = Object.values(producersMapping)
    const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS

    log(`10) Distributor Governance`)
    // Deploy DistributorGovernance contract
    deployResult = await deploy("DistributorGovernance", {
        from: deployer,
        contract: "DistributorGovernance",
        gas: 6000000,
        args: [ADMIN_ADDRESS, producers, collectors],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["10", "DistributorGovernance"];
module.exports.dependencies = ["9"]