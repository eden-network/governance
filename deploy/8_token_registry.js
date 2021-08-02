module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const token = await deployments.get("EdenToken");
    const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS
    const SUSHI_LP_VP_CVR = process.env.SUSHI_LP_VP_CVR
    const SUSHI_POOL_ADDRESS = process.env.SUSHI_POOL_ADDRESS

    log(`8) TokenRegistry`)
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

    // Deploy SushiLPFormula contract
    deployResult = await deploy("SushiLPFormula", {
        from: deployer,
        contract: "SushiLPFormula",
        gas: 4000000,
        args: [ADMIN_ADDRESS, SUSHI_LP_VP_CVR],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }

    const edenFormula = await deployments.get("EdenFormula")
    const sushiFormula = await deployments.get("SushiLPFormula")

    // Deploy Token Registry contract
    deployResult = await deploy("TokenRegistry", {
        from: deployer,
        contract: "TokenRegistry",
        gas: 4000000,
        args: [ADMIN_ADDRESS, [token.address, SUSHI_POOL_ADDRESS], [edenFormula.address, sushiFormula.address]],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["8", "TokenRegistry"];
module.exports.dependencies = ["7"]