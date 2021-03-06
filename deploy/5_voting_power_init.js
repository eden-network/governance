module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
    const { execute, log } = deployments;
    const { deployer } = await getNamedAccounts()
    const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS
    const deployerSigner = await ethers.getSigner(deployer)
    const votingPowerImplementation = await deployments.get("VotingPower");
    const votingPowerPrism = await deployments.get("VotingPowerPrism");
    const votingPower = new ethers.Contract(votingPowerPrism.address, votingPowerImplementation.abi, deployerSigner)
    const token = await deployments.get("EdenToken");
    log(`5) Initialize Voting Power`)
    // Set pending implementation for voting power prism
    await execute('VotingPowerPrism', {from: deployer }, 'setPendingProxyImplementation', votingPowerImplementation.address);
    log(`- Set pending voting power implementation for prism at ${votingPowerPrism.address} to contract at ${votingPowerImplementation.address}`);

    // Accept voting power implementation
    await execute('VotingPower', {from: deployer }, 'become', votingPowerPrism.address);
    log(`- Accepted pending voting power implementation of contract at ${votingPowerImplementation.address}`);

    // Initialize voting power contract
    const result = await votingPower.initialize(token.address, deployer)
    if (result.hash) {
        const receipt = await ethers.provider.waitForTransaction(result.hash)
        if(receipt.status) {
            log(`- Initialized voting power at ${votingPowerImplementation.address} via prism at ${votingPowerPrism.address}`);
        } else {
            log(`- Error initializing voting power. Tx:`)
            log(receipt)
        }
    } else {
        log(`- Error initializing voting power. Tx:`)
        log(result)
    }


    // Set pending admin for voting power
    await execute('VotingPowerPrism', {from: deployer }, 'setPendingProxyAdmin', ADMIN_ADDRESS);
    log(`- Set pending voting power admin for prism at ${votingPowerPrism.address} to ${ADMIN_ADDRESS}`);
    log(`- ${ADMIN_ADDRESS} can now call 'acceptAdmin' via the voting power prism proxy to become the admin`);
};

module.exports.skip = async function({ ethers, deployments, getNamedAccounts }) {
    const { log } = deployments
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
    const { deployer } = await getNamedAccounts()
    const deployerSigner = await ethers.getSigner(deployer)
    const token = await deployments.get("EdenToken");
    const votingPowerImplementation = await deployments.get("VotingPower");
    const votingPowerPrism = await deployments.get("VotingPowerPrism");
    if(token.address != ZERO_ADDRESS && votingPowerImplementation.address != ZERO_ADDRESS && votingPowerPrism.address) {
        const votingPower = new ethers.Contract(votingPowerPrism.address, votingPowerImplementation.abi, deployerSigner)
        try {
            const vpEdenToken = await votingPower.edenToken()
            if(token.address != "0x0000000000000000000000000000000000000000" && vpEdenToken == token.address) {
                log(`4) Initialize Voting Power`)
                log(`- Skipping step, voting power prism at ${votingPower.address} already initialized`)
                return true
            } else {
                return false
            }
             
        } catch {
            return false
        }
    } else {
        return false
    }
}

module.exports.tags = ["5", "VotingPowerInit"];
module.exports.dependencies = ["4"]