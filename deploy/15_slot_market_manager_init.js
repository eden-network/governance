module.exports = async ({ ethers, getNamedAccounts, deployments }) => {
  const { execute, log } = deployments;
  const { deployer, admin } = await getNamedAccounts();
  const slotMarketProxy = await deployments.get("SlotMarketProxy")

  log(`15) SlotMarketManager Init`)
  // Initialize SlotMarketManager contract
  await execute('SlotMarketManager', {from: deployer }, 'initialize', slotMarketProxy.address, admin);
  log(`- Slot Market Manager initialized`)
};

module.exports.skip = async function({ deployments }) {
    const { read, log } = deployments
    const slotMarketProxy = await read('SlotMarketManager', 'slotMarketProxy');
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
    if(slotMarketProxy == ZERO_ADDRESS) {
        return false
    }
    log(`15) SlotMarketManager Init`)
    log(`- Skipping step, Slot Market Manager already initialized`)
    return true
}

module.exports.tags = ["15", "SlotMarketManagerInit"]
module.exports.dependencies = ["14"]