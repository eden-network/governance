module.exports = async ({ ethers, getNamedAccounts, deployments }) => {
  const { log } = deployments;
  const { deployer } = await getNamedAccounts();
  const deployerSigner = await ethers.getSigner(deployer)
  const registry = await deployments.get('TokenRegistry')
  const lockManager = await deployments.get('LockManager')
  const votingPowerImplementation = await deployments.get("VotingPower");
  const votingPowerPrism = await deployments.get("VotingPowerPrism");
  const votingPower = new ethers.Contract(votingPowerPrism.address, votingPowerImplementation.abi, deployerSigner)
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS

  log(`16) Finalize VP`)
  // Grant roles
  let result = await votingPower.setTokenRegistry(registry.address)
  if (result.hash) {
      let receipt = await ethers.provider.waitForTransaction(result.hash)
      if(receipt.status) {
          log(`- Set Token Registry to ${registry.address} via prism at ${votingPowerPrism.address}`);
      } else {
          log(`- Error setting token registry. Tx:`)
          log(receipt)
      }
  } else {
      log(`- Error setting token registry. Tx:`)
      log(result)
  }

  result = await votingPower.setLockManager(lockManager.address)
  if (result.hash) {
      receipt = await ethers.provider.waitForTransaction(result.hash)
      if(receipt.status) {
          log(`- Set Lock Manager to ${lockManager.address} via prism at ${votingPowerPrism.address}`);
      } else {
          log(`- Error setting lock manager. Tx:`)
          log(receipt)
      }
  } else {
      log(`- Error setting lock manager. Tx:`)
      log(result)
  }

  result = await votingPower.changeOwner(ADMIN_ADDRESS)
  if (result.hash) {
      receipt = await ethers.provider.waitForTransaction(result.hash)
      if(receipt.status) {
          log(`- Set VP owner to ${ADMIN_ADDRESS} via prism at ${votingPowerPrism.address}`);
      } else {
          log(`- Error setting owner. Tx:`)
          log(receipt)
      }
  } else {
      log(`- Error setting owner. Tx:`)
      log(result)
  }
};

module.exports.skip = async function({ deployments, getNamedAccounts }) {
    const { log } = deployments
    const { deployer } = await getNamedAccounts();
    const deployerSigner = await ethers.getSigner(deployer)
    const lockManager = await deployments.get('LockManager')
    const votingPowerImplementation = await deployments.get("VotingPower");
    const votingPowerPrism = await deployments.get("VotingPowerPrism");
    const votingPower = new ethers.Contract(votingPowerPrism.address, votingPowerImplementation.abi, deployerSigner)
    const vpLockManager = await votingPower.lockManager()
    if(vpLockManager != lockManager.address) {
      return false
    }
    log(`16) Finalize VP`)
    log(`- Skipping step, vp has been finalized`)
    return true
}

module.exports.tags = ["16", "FinalizeVP"]
module.exports.dependencies = ["15"]