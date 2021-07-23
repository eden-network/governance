module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer, admin } = namedAccounts;
    const token = await deployments.get("EdenToken");

    log(`7) TokenRegistry`)
    // Deploy EdenFormula contract
    let deployResult = await deploy("EdenFormula", {
        from: deployer,
        contract: "EdenFormula",
        gas: 4000000,
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }

    const edenFormula = await deployments.get("EdenFormula")

    // Deploy Token Registry contract
    deployResult = await deploy("TokenRegistry", {
        from: deployer,
        contract: "TokenRegistry",
        gas: 4000000,
        args: [admin, [token.address], [edenFormula.address]],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["7", "TokenRegistry"];
module.exports.dependencies = ["6"]