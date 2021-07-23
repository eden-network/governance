module.exports = async function ({ ethers, getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const namedAccounts = await getNamedAccounts();
    const { deployer, admin } = namedAccounts;
    const SUSHI_ADDRESS = process.env.SUSHI_ADDRESS
    const MASTERCHEF_ADDRESS = process.env.MASTERCHEF_ADDRESS
    const EDEN_REWARDS_PER_BLOCK = process.env.EDEN_REWARDS_PER_BLOCK
    const EDEN_REWARDS_START_BLOCK = process.env.EDEN_REWARDS_START_BLOCK
    const edenToken = await deployments.get("EdenToken")
    const lockManager = await deployments.get("LockManager")
    const vault = await deployments.get("Vault")

    log(`8) Rewards Manager`)
    // Deploy RewardsManager contract
    deployResult = await deploy("RewardsManager", {
        from: deployer,
        contract: "RewardsManager",
        gas: 4000000,
        args: [admin, lockManager.address, vault.address, edenToken.address, SUSHI_ADDRESS, MASTERCHEF_ADDRESS, EDEN_REWARDS_START_BLOCK, EDEN_REWARDS_PER_BLOCK],
        skipIfAlreadyDeployed: true
    });

    if (deployResult.newlyDeployed) {
        log(`- ${deployResult.contractName} deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`);
    } else {
        log(`- Deployment skipped, using previous deployment at: ${deployResult.address}`)
    }
};

module.exports.tags = ["8", "RewardsManager"];
module.exports.dependencies = ["7"]