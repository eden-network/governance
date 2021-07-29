const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require("hardhat");

const EDEN_TOKEN_ADDRESS = process.env.EDEN_TOKEN_ADDRESS
const EDEN_ABI = require("./abis/EdenToken.json")
const SUSHI_ADDRESS = process.env.SUSHI_ADDRESS
const SUSHI_ABI = require("./abis/ERC20.json")
const MASTERCHEF_ADDRESS = process.env.MASTERCHEF_ADDRESS
const MASTERCHEF_ABI = require("./abis/MasterChef.json")
const SUSHI_FACTORY_ADDRESS = process.env.SUSHI_FACTORY_ADDRESS
const SUSHI_FACTORY_ABI = require("./abis/SushiFactory.json")
const SUSHI_POOL_ABI = require("./abis/SushiPool.json")
const SUSHI_ROUTER_ADDRESS = process.env.SUSHI_ROUTER_ADDRESS
const SUSHI_ROUTER_ABI = require("./abis/SushiRouter.json")
const SUSHI_LP_VP_CVR = process.env.SUSHI_LP_VP_CVR
const VOTING_POWER_ADDRESS = process.env.VOTING_POWER_ADDRESS
const VOTING_POWER_ABI = require("./abis/VotingPower.json")
const DAO_TREASURY_ADDRESS = process.env.DAO_TREASURY_ADDRESS
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS
const INITIAL_EDEN_REWARDS_BALANCE = process.env.INITIAL_EDEN_REWARDS_BALANCE
const EDEN_REWARDS_START_BLOCK = process.env.EDEN_REWARDS_START_BLOCK
const EDEN_REWARDS_PER_BLOCK = process.env.EDEN_REWARDS_PER_BLOCK
const TOKEN_LIQUIDITY = "100000000000000000000"
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const tokenFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0]
    const admin = accounts[1]
    const alice = accounts[5]
    const bob = accounts[6]
    const EdenTokenFactory = await ethers.getContractFactory("EdenToken");
    const EdenToken = await EdenTokenFactory.deploy(admin.address);
    await EdenToken.connect(admin).grantRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', deployer.address)
    await EdenToken.mint(deployer.address, "100000000000000000000000000")
    return {
        edenToken: EdenToken,
        deployer: deployer,
        admin: admin,
        alice: alice,
        bob: bob,
        ZERO_ADDRESS: ZERO_ADDRESS
    };
})

const governanceFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0]
    const admin = accounts[1]
    const alice = accounts[5]
    const bob = accounts[6]
    const EdenTokenFactory = await ethers.getContractFactory("EdenToken");
    const EdenToken = await EdenTokenFactory.deploy(admin.address);
    await EdenToken.connect(admin).grantRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', deployer.address)
    await EdenToken.mint(deployer.address, "100000000000000000000000000")
    const VotingPowerFactory = await ethers.getContractFactory("VotingPower");
    const VotingPowerImp = await VotingPowerFactory.deploy();
    const VotingPowerPrismFactory = await ethers.getContractFactory("VotingPowerPrism");
    const VotingPowerPrism = await VotingPowerPrismFactory.deploy(deployer.address);
    const VotingPower = new ethers.Contract(VotingPowerPrism.address, VotingPowerImp.interface, deployer)
    const LockManagerFactory = await ethers.getContractFactory("LockManager");
    const LockManager = await LockManagerFactory.deploy(VotingPowerPrism.address, deployer.address)
    const VaultFactory = await ethers.getContractFactory("Vault");
    const Vault = await VaultFactory.deploy(LockManager.address);

    return {
        edenToken: EdenToken,
        votingPower: VotingPower,
        votingPowerImplementation: VotingPowerImp,
        votingPowerPrism: VotingPowerPrism,
        lockManager: LockManager,
        vault: Vault,
        deployer: deployer,
        admin: admin,
        alice: alice,
        bob: bob,
        ZERO_ADDRESS: ZERO_ADDRESS
    };
})

const rewardsFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const deployer = accounts[0]
    const admin = accounts[1]
    const alice = accounts[5]
    const bob = accounts[6]
    const EdenTokenFactory = await ethers.getContractFactory("EdenToken");
    const EdenToken = await EdenTokenFactory.deploy(admin.address);
    await EdenToken.connect(admin).grantRole('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6', deployer.address)
    await EdenToken.mint(deployer.address, "10000000000000000000000000")
    await EdenToken.mint(admin.address, "10000000000000000000000000")
    await EdenToken.mint(alice.address, "10000000000000000000000000")
    await EdenToken.mint(bob.address, "10000000000000000000000000")
    
    const VotingPowerFactory = await ethers.getContractFactory("VotingPower");
    const VotingPowerImp = await VotingPowerFactory.deploy();
    const VotingPowerPrismFactory = await ethers.getContractFactory("VotingPowerPrism");
    const VotingPowerPrism = await VotingPowerPrismFactory.deploy(deployer.address);
    const VotingPower = new ethers.Contract(VotingPowerPrism.address, VotingPowerImp.interface, deployer)
    await VotingPower.connect(admin).setPendingProxyImplementation(VotingPowerImp.address)
    await VotingPowerImp.connect(admin).become(VotingPower.address)

    const MasterChef = new ethers.Contract(MASTERCHEF_ADDRESS, MASTERCHEF_ABI, deployer)
    const SushiRouter = new ethers.Contract(SUSHI_ROUTER_ADDRESS, SUSHI_ROUTER_ABI, deployer)
    const WETH_ADDRESS = await SushiRouter.WETH()
    const SushiFactory = new ethers.Contract(SUSHI_FACTORY_ADDRESS, SUSHI_FACTORY_ABI, deployer)
    const SUSHI_POOL_ADDRESS = await SushiFactory.getPair(WETH_ADDRESS, EdenToken.address)
    const SushiPool = new ethers.Contract(SUSHI_POOL_ADDRESS, SUSHI_POOL_ABI, deployer)
    const SushiToken = new ethers.Contract(SUSHI_ADDRESS, SUSHI_ABI, deployer)

    const EdenFormulaFactory = await ethers.getContractFactory("EdenFormula");
    const EdenFormula = await EdenFormulaFactory.deploy()
    const SushiFormulaFactory = await ethers.getContractFactory("SushiLPFormula")
    const SushiFormula = await SushiFormulaFactory.deploy(ADMIN_ADDRESS, SUSHI_LP_VP_CVR)
    const TokenRegistryFactory = await ethers.getContractFactory("TokenRegistry");
    const TokenRegistry = await TokenRegistryFactory.deploy(ADMIN_ADDRESS, [EDEN_TOKEN_ADDRESS, SUSHI_POOL_ADDRESS], [EdenFormula.address, SushiFormula.address])
    await VotingPower.connect(admin).setTokenRegistry(TokenRegistry.address)

    const LockManagerFactory = await ethers.getContractFactory("LockManager");
    const LockManager = await LockManagerFactory.deploy(VOTING_POWER_ADDRESS, deployer.address)
    await VotingPower.connect(admin).setLockManager(LockManager.address)
    
    const VaultFactory = await ethers.getContractFactory("Vault");
    const Vault = await VaultFactory.deploy(LockManager.address);
    const RewardsManagerFactory = await ethers.getContractFactory("RewardsManager");
    const RewardsManager = await RewardsManagerFactory.deploy(ADMIN_ADDRESS, LockManager.address, Vault.address, EdenToken.address, SUSHI_ADDRESS, MASTERCHEF_ADDRESS, EDEN_REWARDS_START_BLOCK, EDEN_REWARDS_PER_BLOCK)
    await EdenToken.connect(admin).approve(RewardsManager.address, INITIAL_EDEN_REWARDS_BALANCE)

    return {
        edenToken: EdenToken,
        votingPower: VotingPower,
        lockManager: LockManager,
        vault: Vault,
        rewardsManager: RewardsManager,
        masterChef: MasterChef,
        sushiPool: SushiPool,
        sushiRouter: SushiRouter,
        sushiToken: SushiToken,
        deployer: deployer,
        admin: admin,
        alice: alice,
        bob: bob,
        ZERO_ADDRESS: ZERO_ADDRESS
    };
})

const distributorFixture = deployments.createFixture(async ({deployments, getNamedAccounts, getUnnamedAccounts, ethers}, options) => {
    const accounts = await ethers.getSigners();
    const admin = accounts[0];
    const EdenTokenFactory = await ethers.getContractFactory("EdenToken");
    const EdenToken = await EdenTokenFactory.deploy(admin.address);
    const DistributorGovernanceFactory = await ethers.getContractFactory("DistributorGovernance");
    const DistributorGovernance = await DistributorGovernanceFactory.deploy(admin.address, [], []);
    const MerkleDistributorFactory = await ethers.getContractFactory("MerkleDistributor");
    const MerkleDistributor = await MerkleDistributorFactory.deploy(EdenToken.address, DistributorGovernance.address, admin.address);
    return {
        edenToken: EdenToken,
        distributorGovernance: DistributorGovernance,
        merkleDistributor: MerkleDistributor,
        admin,
        accounts
    };
});

module.exports.tokenFixture = tokenFixture;
module.exports.governanceFixture = governanceFixture;
module.exports.rewardsFixture = rewardsFixture;
module.exports.distributorFixture = distributorFixture;