module.exports = async ({ ethers, getNamedAccounts, deployments }) => {
  const { execute, log } = deployments;
  const { deployer, admin } = await getNamedAccounts();
  const edenNetworkProxy = await deployments.get("EdenNetworkProxy")

  log(`15) EdenNetworkManager Init`)
  // Initialize EdenNetworkManager contract
  await execute('EdenNetworkManager', {from: deployer }, 'initialize', edenNetworkProxy.address, admin);
  log(`- Eden Network Manager initialized`)
};

module.exports.skip = async function({ deployments }) {
    const { read, log } = deployments
    const edenNetworkProxy = await read('EdenNetworkManager', 'edenNetworkProxy');
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
    if(edenNetworkProxy == ZERO_ADDRESS) {
        return false
    }
    log(`15) EdenNetworkManager Init`)
    log(`- Skipping step, Eden Network Manager already initialized`)
    return true
}

module.exports.tags = ["15", "EdenNetworkManagerInit"]
module.exports.dependencies = ["14"]