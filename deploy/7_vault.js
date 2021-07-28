module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer } = namedAccounts;
    const lockManager = await deployments.get("LockManager")

    log(`7) Vault`)
    // Deploy Vault contract
    const deployResult = await deploy("Vault", {
        from: deployer,
        contract: "Vault",
        gas: 4000000,
        args: [lockManager.address],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["7", "Vault"];
module.exports.dependencies = ["6"]