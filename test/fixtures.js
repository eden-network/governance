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
    const admin = accounts[4]
    const alice = accounts[5]
    const bob = accounts[6]
    const EdenTokenFactory = await ethers.getContractFactory("EdenToken");
    const EdenToken = await EdenTokenFactory.deploy(admin.address);
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
    const admin = accounts[4]
    const alice = accounts[5]
    const bob = accounts[6]
    const EdenTokenFactory = await ethers.getContractFactory("EdenToken");
    const EdenToken = await EdenTokenFactory.deploy(admin.address);
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
    const admin = await ethers.provider.getSigner(ADMIN_ADDRESS)
    const alice = accounts[5]
    const bob = accounts[6]
    await ethers.provider.send('hardhat_impersonateAccount', [DAO_TREASURY_ADDRESS]);
    const treasury = await ethers.provider.getSigner(DAO_TREASURY_ADDRESS)
    const EdenToken = new ethers.Contract(EDEN_TOKEN_ADDRESS, EDEN_ABI, deployer)
    await deployer.sendTransaction({ to: DAO_TREASURY_ADDRESS, value: ethers.utils.parseEther("0.5")})
    await EdenToken.connect(treasury).transfer(ADMIN_ADDRESS, ethers.BigNumber.from(INITIAL_EDEN_REWARDS_BALANCE))
    await EdenToken.connect(treasury).transfer(deployer.address, ethers.BigNumber.from(INITIAL_EDEN_REWARDS_BALANCE))
    await EdenToken.connect(treasury).transfer(alice.address, ethers.BigNumber.from(TOKEN_LIQUIDITY))
    await EdenToken.connect(treasury).transfer(bob.address, ethers.BigNumber.from(TOKEN_LIQUIDITY))
    await deployer.sendTransaction({ to: ADMIN_ADDRESS, value: ethers.utils.parseEther("1.0")})
    await deployer.sendTransaction({ to: alice.address, value: ethers.utils.parseEther("1.0")})
    await deployer.sendTransaction({ to: bob.address, value: ethers.utils.parseEther("1.0")})
    await ethers.provider.send('hardhat_stopImpersonatingAccount', [DAO_TREASURY_ADDRESS]);
    await ethers.provider.send('hardhat_impersonateAccount', [ADMIN_ADDRESS]);
    
    const VotingPower = new ethers.Contract(VOTING_POWER_ADDRESS, VOTING_POWER_ABI, deployer)
    const VotingPowerFactory = await ethers.getContractFactory("VotingPower");
    const VotingPowerImp = await VotingPowerFactory.deploy();
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

module.exports.tokenFixture = tokenFixture;
module.exports.governanceFixture = governanceFixture;
module.exports.rewardsFixture = rewardsFixture;