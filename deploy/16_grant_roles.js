module.exports = async ({ ethers, getNamedAccounts, deployments }) => {
  const { execute, log } = deployments;
  const { deployer, admin } = await getNamedAccounts();
  const migrator = await deployments.get('Migrator')
  const rewardsManager = await deployments.get('RewardsManager')
  const distributor = await deployments.get('MerkleDistributor')
  const vault = await deployments.get('Vault')
  const edenNetworkProxy = await deployments.get('EdenNetworkProxy')
  const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
  const LOCKER_ROLE = "0xaf9a8bb3cbd6b84fbccefa71ff73e26e798553c6914585a84886212a46a90279"
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000"

  log(`16) Grant Roles`)
  // Grant roles
  await execute('LockManager', { from: deployer }, 'grantRole', LOCKER_ROLE, rewardsManager.address);
  log(`- Granted locker role to rewards manager`)

  await execute('LockManager', { from: deployer }, 'grantRole', LOCKER_ROLE, vault.address);
  log(`- Granted locker role to vault`)

  await execute('LockManager', { from: deployer }, 'grantRole', LOCKER_ROLE, edenNetworkProxy.address);
  log(`- Granted locker role to eden network proxy`)

  await execute('LockManager', { from: deployer }, 'grantRole', DEFAULT_ADMIN_ROLE, admin);
  log(`- Granted locker admin role to ${admin}`)

  await execute('LockManager', { from: deployer }, 'renounceRole', DEFAULT_ADMIN_ROLE, deployer);
  log(`- Deployer renounced locker admin role`)

  await execute('EdenToken', { from: deployer }, 'grantRole', MINTER_ROLE, migrator.address);
  log(`- Granted minter role to migrator`)

  await execute('EdenToken', { from: deployer }, 'grantRole', MINTER_ROLE, rewardsManager.address);
  log(`- Granted minter role to rewards manager`)

  await execute('EdenToken', { from: deployer }, 'grantRole', MINTER_ROLE, distributor.address);
  log(`- Granted minter role to distributor`)

  await execute('EdenToken', { from: deployer }, 'grantRole', DEFAULT_ADMIN_ROLE, admin);
  log(`- Granted token admin role to ${admin}`)

  await execute('EdenToken', { from: deployer }, 'renounceRole', DEFAULT_ADMIN_ROLE, deployer);
  log(`- Deployer token renounced admin role`)
};

module.exports.skip = async function({ deployments }) {
    const { read, log } = deployments
    const deployerIsAdmin = await read('EdenToken', 'hasRole', DEFAULT_ADMIN_ROLE, deployer);
    if(deployerIsAdmin) {
      return false
    }
    log(`16) Grant Roles`)
    log(`- Skipping step, roles have already been granted`)
    return true
}

module.exports.tags = ["16", "GrantRoles"]
module.exports.dependencies = ["15"]