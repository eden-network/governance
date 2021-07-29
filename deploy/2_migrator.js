module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const ARCH_ADDRESS = process.env.ARCH_ADDRESS
    const edenToken = await deployments.get("EdenToken")

    log(`2) Migrator`)
    // Deploy Migrator contract
    deployResult = await deploy("Migrator", {
        from: deployer,
        contract: "Migrator",
        gas: 4000000,
        args: [ARCH_ADDRESS, edenToken.address],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["2", "Migrator"];
module.exports.dependencies = ["1"]