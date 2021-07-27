const { expect } = require("chai")
const { ethers } = require("hardhat");
const { rewardsFixture } = require("../fixtures")

const INITIAL_EDEN_REWARDS_BALANCE = process.env.INITIAL_EDEN_REWARDS_BALANCE
const MASTERCHEF_POOL_ID = process.env.MASTERCHEF_POOL_ID
const UNI_POOL_ADDRESS = process.env.UNI_POOL_ADDRESS
const EDEN_REWARDS_PER_BLOCK = process.env.EDEN_REWARDS_PER_BLOCK
const SUSHI_LP_VP_CVR = process.env.SUSHI_LP_VP_CVR
const FACTOR = ethers.BigNumber.from("10").pow("12")

describe('RewardsManager', () => {
    let edenToken
    let rewardsManager
    let vault
    let votingPower
    let lockManager
    let masterChef
    let sushiPool
    let sushiRouter
    let sushiToken
    let deployer
    let admin
    let alice
    let bob

    beforeEach(async () => {
        const fix = await rewardsFixture()
        edenToken = fix.edenToken
        votingPower = fix.votingPower
        rewardsManager = fix.rewardsManager
        vault = fix.vault
        lockManager = fix.lockManager
        masterChef = fix.masterChef
        sushiPool = fix.sushiPool
        sushiRouter = fix.sushiRouter
        sushiToken = fix.sushiToken
        deployer = fix.deployer
        admin = fix.admin
        alice = fix.alice
        bob = fix.bob
        startBlock = await rewardsManager.startBlock()
    })

    context('before startBlock', async () => {
        context('rewardsActive', async () => {
            it('returns false if rewards period has not started', async () => {
                expect(await rewardsManager.rewardsActive()).to.eq(false)
                await rewardsManager.connect(admin).addRewardsBalance(INITIAL_EDEN_REWARDS_BALANCE)
                expect(await rewardsManager.rewardsActive()).to.eq(false)
            })
        })
    })

    context('startBlock', async () => {
        context('rewardsActive', async () => {
            beforeEach(async () => {
                const blockNumber = await ethers.provider.getBlockNumber()
                let numBlocks = startBlock.sub(blockNumber)
                for(var i = 0; i < numBlocks.sub(1).toNumber(); i++) {
                    await ethers.provider.send("evm_mine")
                }
            })
            it('returns true if rewards period is active', async () => {
                expect(await rewardsManager.rewardsActive()).to.eq(false)
                await rewardsManager.connect(admin).addRewardsBalance(INITIAL_EDEN_REWARDS_BALANCE)
                const ALLOC_POINTS = "10"
                const VESTING_PERCENT = "666666"
                const VESTING_PERIOD = "180"
                await rewardsManager.connect(admin).add(ALLOC_POINTS, sushiPool.address, VESTING_PERCENT, VESTING_PERIOD, 0, true, MASTERCHEF_POOL_ID, true, true)
                expect(await rewardsManager.rewardsActive()).to.eq(true)
            })
        })
    
        context('add', async () => {
            beforeEach(async () => {
                await rewardsManager.connect(admin).addRewardsBalance(INITIAL_EDEN_REWARDS_BALANCE)
            })
            it('successfully adds a valid sushi pool', async () => {
                const ALLOC_POINTS = "10"
                const VESTING_PERCENT = "666666"
                const VESTING_PERIOD = "180"
                const numPools = await rewardsManager.poolLength()
                const numTotalAllocPoints = await rewardsManager.totalAllocPoint()
                const blockNumber = await ethers.provider.getBlockNumber()
                const txBlock = ethers.BigNumber.from(blockNumber).add(1)
                await rewardsManager.connect(admin).add(ALLOC_POINTS, sushiPool.address, VESTING_PERCENT, VESTING_PERIOD, 0, true, MASTERCHEF_POOL_ID, true, true)
                expect(await rewardsManager.poolLength()).to.eq(numPools.add(1))
                expect(await rewardsManager.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))
                expect(await rewardsManager.sushiPools(sushiPool.address)).to.eq(MASTERCHEF_POOL_ID)
                const contractBal = await edenToken.balanceOf(rewardsManager.address)
                const rewardsPerBlock = await rewardsManager.rewardTokensPerBlock()
                const newPool = await rewardsManager.poolInfo(numPools)
                expect(newPool.token).to.eq(sushiPool.address)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                expect(newPool.vestingPercent.toString()).to.eq(VESTING_PERCENT)
                expect(newPool.vestingPeriod.toString()).to.eq(VESTING_PERIOD)
                expect(await rewardsManager.endBlock()).to.eq(txBlock.add(contractBal.div(rewardsPerBlock)))
            })

            it('successfully adds a valid uni pool', async () => {
                const ALLOC_POINTS = "10"
                const VESTING_PERCENT = "666666"
                const VESTING_PERIOD = "180"
                const numPools = await rewardsManager.poolLength()
                const numTotalAllocPoints = await rewardsManager.totalAllocPoint()
                await rewardsManager.connect(admin).add(ALLOC_POINTS, UNI_POOL_ADDRESS, VESTING_PERCENT, VESTING_PERIOD, 0, true, 0, true, true)
                expect(await rewardsManager.poolLength()).to.eq(numPools.add(1))
                expect(await rewardsManager.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))
                expect(await rewardsManager.sushiPools(UNI_POOL_ADDRESS)).to.eq(0)
                const newPool = await rewardsManager.poolInfo(numPools)
                expect(newPool.token).to.eq(UNI_POOL_ADDRESS)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                expect(newPool.vestingPercent.toString()).to.eq(VESTING_PERCENT)
                expect(newPool.vestingPeriod.toString()).to.eq(VESTING_PERIOD)
            })

            it('successfully adds a valid sushi pool w/o voting power', async () => {
                const ALLOC_POINTS = "10"
                const VESTING_PERCENT = "666666"
                const VESTING_PERIOD = "180"
                const TOKEN_LIQUIDITY = "100000000000000000000"
                const ETH_LIQUIDITY = "500000000000000000"
                let numPools = await rewardsManager.poolLength()
                const numTotalAllocPoints = await rewardsManager.totalAllocPoint()
                const blockNumber = await ethers.provider.getBlockNumber()
                const txBlock = ethers.BigNumber.from(blockNumber).add(1)
                await rewardsManager.connect(admin).add(ALLOC_POINTS, sushiPool.address, VESTING_PERCENT, VESTING_PERIOD, 0, true, MASTERCHEF_POOL_ID, false, false)
                expect(await rewardsManager.poolLength()).to.eq(numPools.add(1))
                expect(await rewardsManager.totalAllocPoint()).to.eq(numTotalAllocPoints.add(ALLOC_POINTS))
                expect(await rewardsManager.sushiPools(sushiPool.address)).to.eq(MASTERCHEF_POOL_ID)
                const contractBal = await edenToken.balanceOf(rewardsManager.address)
                const rewardsPerBlock = await rewardsManager.rewardTokensPerBlock()
                const newPool = await rewardsManager.poolInfo(numPools)
                expect(newPool.token).to.eq(sushiPool.address)
                expect(newPool.allocPoint).to.eq(ALLOC_POINTS)
                expect(newPool.vestingPercent.toString()).to.eq(VESTING_PERCENT)
                expect(newPool.vestingPeriod.toString()).to.eq(VESTING_PERIOD)
                expect(await rewardsManager.endBlock()).to.eq(txBlock.add(contractBal.div(rewardsPerBlock)))
                await edenToken.approve(sushiRouter.address, TOKEN_LIQUIDITY)
                await sushiRouter.addLiquidityETH(edenToken.address, TOKEN_LIQUIDITY, "0", "0", deployer.address, ethers.constants.MaxUint256, { from: deployer.address, value: ETH_LIQUIDITY, gasLimit: 6000000 })
                numPools = await rewardsManager.poolLength()
                const poolIndex = numPools.sub(1)
                const slpBalance = await sushiPool.balanceOf(deployer.address)
                await sushiPool.approve(rewardsManager.address, slpBalance)
                await rewardsManager.deposit(poolIndex, slpBalance)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0)
            })

            it('does not allow non-owner to add sushi pool', async () => {
                const ALLOC_POINTS = "10"
                const VESTING_PERCENT = "666666"
                const VESTING_PERIOD = "180"
                await expect(rewardsManager.add(ALLOC_POINTS, sushiPool.address, VESTING_PERCENT, VESTING_PERIOD, 0, true, MASTERCHEF_POOL_ID, true, true)).to.revertedWith("not owner")
            })
        })

        context('set', async () => {
            beforeEach(async () => {
                const ALLOC_POINTS = "10"
                const VESTING_PERCENT = "666666"
                const VESTING_PERIOD = "180"
                await rewardsManager.connect(admin).addRewardsBalance(INITIAL_EDEN_REWARDS_BALANCE)
                await rewardsManager.connect(admin).add(ALLOC_POINTS, sushiPool.address, VESTING_PERCENT, VESTING_PERIOD, 0, true, MASTERCHEF_POOL_ID, true, true)
            })

            it('allows owner to set alloc points for pool', async () => {
                const ALLOC_POINTS = "20"
                const numPools = await rewardsManager.poolLength()
                const pid = numPools.sub(1)
                await rewardsManager.connect(admin).set(pid, ALLOC_POINTS, true)
                const pool = await rewardsManager.poolInfo(pid)
                expect(pool.allocPoint).to.eq(ALLOC_POINTS)
            })

            it('does not allow non-owner to set alloc points for pool', async () => {
                const ALLOC_POINTS = "20"
                const numPools = await rewardsManager.poolLength()
                const pid = numPools.sub(1)
                await expect(rewardsManager.set(pid, ALLOC_POINTS, true)).to.revertedWith("not owner")
            })
        })

        context('deposit', async () => {
            beforeEach(async () => {
                const vpBefore = await votingPower.balanceOf(deployer.address)
                console.log(vpBefore.toString())
                const ALLOC_POINTS = "10"
                const VESTING_PERCENT = "666666"
                const VESTING_PERIOD = "180"
                const TOKEN_LIQUIDITY = "100000000000000000000"
                const ETH_LIQUIDITY = "500000000000000000"
                await rewardsManager.connect(admin).addRewardsBalance(INITIAL_EDEN_REWARDS_BALANCE)
                await rewardsManager.connect(admin).add(ALLOC_POINTS, sushiPool.address, VESTING_PERCENT, VESTING_PERIOD, 0, true, MASTERCHEF_POOL_ID, true, true)
                await lockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), rewardsManager.address)
                await lockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), vault.address)
                await edenToken.approve(sushiRouter.address, TOKEN_LIQUIDITY)
                await sushiRouter.addLiquidityETH(edenToken.address, TOKEN_LIQUIDITY, "0", "0", deployer.address, ethers.constants.MaxUint256, { from: deployer.address, value: ETH_LIQUIDITY, gasLimit: 6000000 })
                const blockNumber = await ethers.provider.getBlockNumber()
                let numBlocks = startBlock.sub(blockNumber)
                for(var i = 0; i < numBlocks.sub(1).toNumber(); i++) {
                    await ethers.provider.send("evm_mine")
                }
            })
            it('creates a valid deposit for a sushi pool', async () => {
                const numPools = await rewardsManager.poolLength()
                const poolIndex = numPools.sub(1)
                const slpBalance = await sushiPool.balanceOf(deployer.address)
                const sushiPerBlock = await masterChef.sushiPerBlock()
                let masterChefSLPBalanceBefore = await sushiPool.balanceOf(masterChef.address)
                const masterChefTotalAlloc = await masterChef.totalAllocPoint()
                await sushiPool.approve(rewardsManager.address, slpBalance)
                let blockNumber = await ethers.provider.getBlockNumber()
                let masterChefPool = await masterChef.poolInfo(MASTERCHEF_POOL_ID)
                let masterChefPoolAlloc = masterChefPool.allocPoint
                let masterChefLastRewardBlock = masterChefPool.lastRewardBlock
                const multiplier = ethers.BigNumber.from(blockNumber).add(1).sub(masterChefLastRewardBlock)
                const sushiReward = multiplier.mul(sushiPerBlock).mul(masterChefPoolAlloc).div(masterChefTotalAlloc)
                const accSushiPerShare = masterChefPool.accSushiPerShare.add(sushiReward.mul(FACTOR).div(masterChefSLPBalanceBefore))
                await rewardsManager.deposit(poolIndex, slpBalance)
                const pool = await rewardsManager.poolInfo(poolIndex)
                const user = await rewardsManager.userInfo(poolIndex, deployer.address)
                expect(pool.totalStaked).to.eq(slpBalance)
                expect(user.amount).to.eq(slpBalance)
                expect(user.rewardTokenDebt).to.eq(0)
                expect(user.sushiRewardDebt).to.eq(slpBalance.mul(accSushiPerShare).div(FACTOR))
                expect(await lockManager.getAmountStaked(deployer.address, sushiPool.address)).to.eq(slpBalance)
                expect(await sushiPool.balanceOf(masterChef.address)).to.eq(masterChefSLPBalanceBefore.add(slpBalance))
                expect(await votingPower.balanceOf(deployer.address)).to.eq(slpBalance.mul(SUSHI_LP_VP_CVR).div("1000000"))
                expect(await sushiToken.balanceOf(deployer.address)).to.eq(0)
            })

            it('creates multiple valid deposits for sushi pools', async () => {
                const numPools = await rewardsManager.poolLength()
                const poolIndex = numPools.sub(1)
                const slpBalance = await sushiPool.balanceOf(deployer.address)
                const stakeAmount = slpBalance.div(2)
                const sushiPerBlock = await masterChef.sushiPerBlock()
                const masterChefTotalAlloc = await masterChef.totalAllocPoint()
                const deployerEdenBalanceBefore = await edenToken.balanceOf(deployer.address)
                let masterChefSLPBalanceBefore = await sushiPool.balanceOf(masterChef.address)
                await sushiPool.approve(rewardsManager.address, slpBalance)
                await rewardsManager.deposit(poolIndex, stakeAmount)

                let blockNumber = await ethers.provider.getBlockNumber()
                let user = await rewardsManager.userInfo(poolIndex, deployer.address)
                let rewardsPool = await rewardsManager.poolInfo(poolIndex)
                let accRewardsPerShare = rewardsPool.accRewardsPerShare
                accRewardsPerShare = accRewardsPerShare.add(ethers.BigNumber.from(EDEN_REWARDS_PER_BLOCK).mul(FACTOR).div(stakeAmount))
                const pendingEden = stakeAmount.mul(accRewardsPerShare).div(FACTOR)
                let masterChefPool = await masterChef.poolInfo(MASTERCHEF_POOL_ID)
                let masterChefPoolAlloc = masterChefPool.allocPoint
                let masterChefLastRewardBlock = masterChefPool.lastRewardBlock
                let masterChefUser = await masterChef.userInfo(MASTERCHEF_POOL_ID, rewardsManager.address)
                const multiplier = ethers.BigNumber.from(blockNumber).add(1).sub(masterChefLastRewardBlock)
                const sushiReward = multiplier.mul(sushiPerBlock).mul(masterChefPoolAlloc).div(masterChefTotalAlloc)
                const masterChefSLPBalanceAfterDeposit = await sushiPool.balanceOf(masterChef.address)
                const accSushiPerShare = masterChefPool.accSushiPerShare.add(sushiReward.mul(FACTOR).div(masterChefSLPBalanceAfterDeposit))
                const pendingSushi = stakeAmount.mul(accSushiPerShare).div(FACTOR).sub(masterChefUser.rewardDebt)
                expect(user.amount).to.eq(stakeAmount)
                expect(user.rewardTokenDebt).to.eq(0)
                expect(await lockManager.getAmountStaked(deployer.address, sushiPool.address)).to.eq(stakeAmount)
                await rewardsManager.deposit(poolIndex, stakeAmount)

                const pool = await rewardsManager.poolInfo(poolIndex)
                masterChefUser = await masterChef.userInfo(MASTERCHEF_POOL_ID, rewardsManager.address)
                user = await rewardsManager.userInfo(poolIndex, deployer.address)
                const totalStaked = stakeAmount.mul(2);
                expect(pool.totalStaked).to.eq(totalStaked)
                expect(user.amount).to.eq(totalStaked)
                const expectedRewardTokenDebt = totalStaked.mul(pool.accRewardsPerShare).div(FACTOR)
                expect(user.rewardTokenDebt).to.eq(expectedRewardTokenDebt)
                expect(user.sushiRewardDebt).to.eq(masterChefUser.rewardDebt)
                expect(await lockManager.getAmountStaked(deployer.address, sushiPool.address)).to.eq(totalStaked)
                expect(await sushiPool.balanceOf(masterChef.address)).to.eq(masterChefSLPBalanceBefore.add(totalStaked))
                const baseVotingPower = stakeAmount.mul(SUSHI_LP_VP_CVR).div("1000000").mul(2)
                const vestingEden = pendingEden.mul("666666").div("1000000")
                const expectedVotingPower = baseVotingPower.add(vestingEden)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(expectedVotingPower)
                expect(await edenToken.balanceOf(deployer.address)).to.eq(deployerEdenBalanceBefore.add(pendingEden.sub(vestingEden)))
                const sushiBalance = await sushiToken.balanceOf(deployer.address)
                expect(sushiBalance).to.eq(pendingSushi)
            })

            it('allows a user to harvest rewards by passing in zero as amount', async () => {
                const numPools = await rewardsManager.poolLength()
                const poolIndex = numPools.sub(1)
                const slpBalance = await sushiPool.balanceOf(deployer.address)
                const stakeAmount = slpBalance.div(2)
                const sushiPerBlock = await masterChef.sushiPerBlock()
                const masterChefTotalAlloc = await masterChef.totalAllocPoint()
                const deployerEdenBalanceBefore = await edenToken.balanceOf(deployer.address)
                let masterChefSLPBalanceBefore = await sushiPool.balanceOf(masterChef.address)
                await sushiPool.approve(rewardsManager.address, slpBalance)
                await rewardsManager.deposit(poolIndex, stakeAmount)
                
                let blockNumber = await ethers.provider.getBlockNumber()
                let user = await rewardsManager.userInfo(poolIndex, deployer.address)
                const accRewardsPerShare = ethers.BigNumber.from(EDEN_REWARDS_PER_BLOCK).mul(FACTOR).div(stakeAmount)
                const pendingEden = stakeAmount.mul(accRewardsPerShare).div(FACTOR)
                let masterChefPool = await masterChef.poolInfo(MASTERCHEF_POOL_ID)
                let masterChefPoolAlloc = masterChefPool.allocPoint
                let masterChefLastRewardBlock = masterChefPool.lastRewardBlock
                let masterChefUser = await masterChef.userInfo(MASTERCHEF_POOL_ID, rewardsManager.address)
                const multiplier = ethers.BigNumber.from(blockNumber).add(1).sub(masterChefLastRewardBlock)
                const sushiReward = multiplier.mul(sushiPerBlock).mul(masterChefPoolAlloc).div(masterChefTotalAlloc)
                const masterChefSLPBalanceAfterDeposit = await sushiPool.balanceOf(masterChef.address)
                const accSushiPerShare = masterChefPool.accSushiPerShare.add(sushiReward.mul(FACTOR).div(masterChefSLPBalanceAfterDeposit))
                const pendingSushi = stakeAmount.mul(accSushiPerShare).div(FACTOR).sub(masterChefUser.rewardDebt)

                expect(user.amount).to.eq(stakeAmount)
                expect(user.rewardTokenDebt).to.eq(0)
                expect(await lockManager.getAmountStaked(deployer.address, sushiPool.address)).to.eq(stakeAmount)
                await rewardsManager.deposit(poolIndex, 0)

                const pool = await rewardsManager.poolInfo(poolIndex)
                masterChefUser = await masterChef.userInfo(MASTERCHEF_POOL_ID, rewardsManager.address)
                user = await rewardsManager.userInfo(poolIndex, deployer.address)
                expect(pool.totalStaked).to.eq(stakeAmount)
                expect(user.amount).to.eq(stakeAmount)
                const expectedRewardTokenDebt = stakeAmount.mul(pool.accRewardsPerShare).div(FACTOR)
                expect(user.rewardTokenDebt).to.eq(expectedRewardTokenDebt)
                expect(user.sushiRewardDebt).to.eq(masterChefUser.rewardDebt)
                expect(await lockManager.getAmountStaked(deployer.address, sushiPool.address)).to.eq(stakeAmount)
                expect(await sushiPool.balanceOf(masterChef.address)).to.eq(masterChefSLPBalanceBefore.add(stakeAmount))
                const baseVotingPower = stakeAmount.mul(SUSHI_LP_VP_CVR).div("1000000")
                const vestingEden = pendingEden.mul("666666").div("1000000")
                const claimedEden = pendingEden.sub(vestingEden)
                const expectedVotingPower = baseVotingPower.add(vestingEden)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(expectedVotingPower)
                expect(await edenToken.balanceOf(deployer.address)).to.eq(deployerEdenBalanceBefore.add(claimedEden))
                expect(await sushiToken.balanceOf(rewardsManager.address)).to.eq(0)
                const sushiBalance = await sushiToken.balanceOf(deployer.address)
                expect(sushiBalance).to.eq(pendingSushi)
            })
        })

        context('withdraw', async () => {
            beforeEach(async () => {
                const ALLOC_POINTS = "10"
                const VESTING_PERCENT = "666666"
                const VESTING_PERIOD = "180"
                const TOKEN_LIQUIDITY = "100000000000000000000"
                const ETH_LIQUIDITY = "500000000000000000"
                await rewardsManager.connect(admin).addRewardsBalance(INITIAL_EDEN_REWARDS_BALANCE)
                await rewardsManager.connect(admin).add(ALLOC_POINTS, sushiPool.address, VESTING_PERCENT, VESTING_PERIOD, 0, true, MASTERCHEF_POOL_ID, true, true)
                await lockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), rewardsManager.address)
                await lockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), vault.address)
                await edenToken.approve(sushiRouter.address, TOKEN_LIQUIDITY)
                await sushiRouter.addLiquidityETH(edenToken.address, TOKEN_LIQUIDITY, "0", "0", deployer.address, ethers.constants.MaxUint256, { from: deployer.address, value: ETH_LIQUIDITY, gasLimit: 6000000 })
                const blockNumber = await ethers.provider.getBlockNumber()
                let numBlocks = startBlock.sub(blockNumber)
                for(var i = 0; i < numBlocks.sub(1).toNumber(); i++) {
                    await ethers.provider.send("evm_mine")
                }
            })

            it('allows a user to withdraw all rewards if only lp', async () => {
                const rmEdenBalanceBefore = await edenToken.balanceOf(rewardsManager.address)
                const deployerEdenBalanceBefore = await edenToken.balanceOf(deployer.address)
                const numPools = await rewardsManager.poolLength()
                const poolIndex = numPools.sub(1)
                const slpBalance = await sushiPool.balanceOf(deployer.address)
                const sushiPerBlock = await masterChef.sushiPerBlock()
                const masterChefTotalAlloc = await masterChef.totalAllocPoint()
                await sushiPool.approve(rewardsManager.address, slpBalance)
                await masterChef.updatePool(MASTERCHEF_POOL_ID)
                let masterChefSLPBalanceBefore = await sushiPool.balanceOf(masterChef.address)
                let blockNumber = await ethers.provider.getBlockNumber()
                let masterChefPool = await masterChef.poolInfo(MASTERCHEF_POOL_ID)
                let masterChefPoolAlloc = masterChefPool.allocPoint
                let masterChefLastRewardBlock = masterChefPool.lastRewardBlock
                const multiplier = ethers.BigNumber.from(blockNumber).add(1).sub(masterChefLastRewardBlock)
                const sushiReward = multiplier.mul(sushiPerBlock).mul(masterChefPoolAlloc).div(masterChefTotalAlloc)
                const accSushiPerShare = masterChefPool.accSushiPerShare.add(sushiReward.mul(FACTOR).div(masterChefSLPBalanceBefore))
                await rewardsManager.deposit(poolIndex, slpBalance)
                const depositBlock = ethers.BigNumber.from(blockNumber).add(1)
                let endBlock = await rewardsManager.endBlock()
                let numBlocks = endBlock.sub(depositBlock)
                const pool = await rewardsManager.poolInfo(poolIndex)
                const user = await rewardsManager.userInfo(poolIndex, deployer.address)
                expect(pool.totalStaked).to.eq(slpBalance)
                expect(user.amount).to.eq(slpBalance)
                expect(user.rewardTokenDebt).to.eq(0)
                expect(user.sushiRewardDebt).to.eq(slpBalance.mul(accSushiPerShare).div(FACTOR))
                expect(await lockManager.getAmountStaked(deployer.address, sushiPool.address)).to.eq(slpBalance)
                expect(await sushiPool.balanceOf(masterChef.address)).to.eq(masterChefSLPBalanceBefore.add(slpBalance))
                expect(await votingPower.balanceOf(deployer.address)).to.eq(slpBalance.mul(SUSHI_LP_VP_CVR).div("1000000"))
                for(var i = 0; i < numBlocks.sub(1).toNumber(); i++) {
                    await ethers.provider.send("evm_mine")
                }
                await rewardsManager.withdraw(poolIndex, slpBalance)
                expect(await sushiToken.balanceOf(rewardsManager.address)).to.eq(0)
                const deployerEdenBalanceAfter = await edenToken.balanceOf(deployer.address)
                const vaultEdenBalanceAfter = await edenToken.balanceOf(vault.address)
                const totalEdenDistributed = deployerEdenBalanceAfter.add(vaultEdenBalanceAfter).sub(deployerEdenBalanceBefore)
                const rmEdenBalanceAfter = await edenToken.balanceOf(rewardsManager.address)
                const totalEdenRemoved = rmEdenBalanceAfter.sub(rmEdenBalanceBefore)
                expect(totalEdenDistributed.add(totalEdenRemoved)).to.eq(0)
            })

            it('allows a user to withdraw all rewards if reward period is over', async () => {
                const rmEdenBalanceBefore = await edenToken.balanceOf(rewardsManager.address)
                const deployerEdenBalanceBefore = await edenToken.balanceOf(deployer.address)
                const numPools = await rewardsManager.poolLength()
                const poolIndex = numPools.sub(1)
                const slpBalance = await sushiPool.balanceOf(deployer.address)
                const sushiPerBlock = await masterChef.sushiPerBlock()
                const masterChefTotalAlloc = await masterChef.totalAllocPoint()
                await sushiPool.approve(rewardsManager.address, slpBalance)
                await masterChef.updatePool(MASTERCHEF_POOL_ID)
                let masterChefSLPBalanceBefore = await sushiPool.balanceOf(masterChef.address)
                let blockNumber = await ethers.provider.getBlockNumber()
                let masterChefPool = await masterChef.poolInfo(MASTERCHEF_POOL_ID)
                let masterChefPoolAlloc = masterChefPool.allocPoint
                let masterChefLastRewardBlock = masterChefPool.lastRewardBlock
                const multiplier = ethers.BigNumber.from(blockNumber).add(1).sub(masterChefLastRewardBlock)
                const sushiReward = multiplier.mul(sushiPerBlock).mul(masterChefPoolAlloc).div(masterChefTotalAlloc)
                const accSushiPerShare = masterChefPool.accSushiPerShare.add(sushiReward.mul(FACTOR).div(masterChefSLPBalanceBefore))
                await rewardsManager.deposit(poolIndex, slpBalance)
                const depositBlock = ethers.BigNumber.from(blockNumber).add(1)
                let endBlock = await rewardsManager.endBlock()
                let numBlocks = endBlock.sub(depositBlock)
                const pool = await rewardsManager.poolInfo(poolIndex)
                const user = await rewardsManager.userInfo(poolIndex, deployer.address)
                expect(pool.totalStaked).to.eq(slpBalance)
                expect(user.amount).to.eq(slpBalance)
                expect(user.rewardTokenDebt).to.eq(0)
                expect(user.sushiRewardDebt).to.eq(slpBalance.mul(accSushiPerShare).div(FACTOR))
                expect(await lockManager.getAmountStaked(deployer.address, sushiPool.address)).to.eq(slpBalance)
                expect(await sushiPool.balanceOf(masterChef.address)).to.eq(masterChefSLPBalanceBefore.add(slpBalance))
                expect(await votingPower.balanceOf(deployer.address)).to.eq(slpBalance.mul(SUSHI_LP_VP_CVR).div("1000000"))
                for(var i = 0; i < numBlocks.add(1).toNumber(); i++) {
                    await ethers.provider.send("evm_mine")
                }
                await rewardsManager.withdraw(poolIndex, slpBalance)
                expect(await sushiToken.balanceOf(rewardsManager.address)).to.eq(0)
                const deployerEdenBalanceAfter = await edenToken.balanceOf(deployer.address)
                const vaultEdenBalanceAfter = await edenToken.balanceOf(vault.address)
                const totalEdenDistributed = deployerEdenBalanceAfter.add(vaultEdenBalanceAfter).sub(deployerEdenBalanceBefore)
                const rmEdenBalanceAfter = await edenToken.balanceOf(rewardsManager.address)
                const totalEdenRemoved = rmEdenBalanceAfter.sub(rmEdenBalanceBefore)
                expect(totalEdenDistributed.add(totalEdenRemoved)).to.eq(0)
            })

            it('allows multiple users to withdraw rewards after reward period is over', async () => {
                const TOKEN_LIQUIDITY = "100000000000000000000"
                const ETH_LIQUIDITY = "500000000000000000"
                await edenToken.connect(alice).approve(sushiRouter.address, TOKEN_LIQUIDITY)
                await sushiRouter.connect(alice).addLiquidityETH(edenToken.address, TOKEN_LIQUIDITY, "0", "0", alice.address, ethers.constants.MaxUint256, { from: alice.address, value: ETH_LIQUIDITY, gasLimit: 6000000 })
                await edenToken.connect(bob).approve(sushiRouter.address, TOKEN_LIQUIDITY)
                await sushiRouter.connect(bob).addLiquidityETH(edenToken.address, TOKEN_LIQUIDITY, "0", "0", bob.address, ethers.constants.MaxUint256, { from: bob.address, value: ETH_LIQUIDITY, gasLimit: 6000000 })
                const rmEdenBalanceBefore = await edenToken.balanceOf(rewardsManager.address)
                const deployerEdenBalanceBefore = await edenToken.balanceOf(deployer.address)
                const aliceEdenBalanceBefore = await edenToken.balanceOf(alice.address)
                const bobEdenBalanceBefore = await edenToken.balanceOf(bob.address)
                const numPools = await rewardsManager.poolLength()
                const poolIndex = numPools.sub(1)
                const deployerSlpBalance = await sushiPool.balanceOf(deployer.address)
                const aliceSlpBalance = await sushiPool.balanceOf(alice.address)
                const bobSlpBalance = await sushiPool.balanceOf(bob.address)
                const totalSlpBalance = deployerSlpBalance.add(aliceSlpBalance).add(bobSlpBalance)
                const rewardsPerBlock = await rewardsManager.rewardTokensPerBlock()
                const rmTotalAlloc = await rewardsManager.totalAllocPoint()
                const sushiPerBlock = await masterChef.sushiPerBlock()
                const masterChefTotalAlloc = await masterChef.totalAllocPoint()
                await sushiPool.approve(rewardsManager.address, deployerSlpBalance)
                await sushiPool.connect(alice).approve(rewardsManager.address, aliceSlpBalance)
                await sushiPool.connect(bob).approve(rewardsManager.address, bobSlpBalance)
                await masterChef.updatePool(MASTERCHEF_POOL_ID)
                let masterChefSLPBalanceBefore = await sushiPool.balanceOf(masterChef.address)
                let blockNumber = await ethers.provider.getBlockNumber()
                let masterChefPool = await masterChef.poolInfo(MASTERCHEF_POOL_ID)
                let masterChefPoolAlloc = masterChefPool.allocPoint
                let masterChefLastRewardBlock = masterChefPool.lastRewardBlock
                let rmPool = await rewardsManager.poolInfo(poolIndex)
                let rmSLPBalanceBefore = rmPool.totalStaked
                let rmPoolAlloc = rmPool.allocPoint
                let multiplier = ethers.BigNumber.from(blockNumber).add(1).sub(masterChefLastRewardBlock)
                let sushiReward = multiplier.mul(sushiPerBlock).mul(masterChefPoolAlloc).div(masterChefTotalAlloc)
                let accSushiPerShare = masterChefPool.accSushiPerShare.add(sushiReward.mul(FACTOR).div(masterChefSLPBalanceBefore))
                await rewardsManager.deposit(poolIndex, deployerSlpBalance)
                await rewardsManager.connect(alice).deposit(poolIndex, aliceSlpBalance)
                await rewardsManager.connect(bob).deposit(poolIndex, bobSlpBalance)
                const depositBlock = ethers.BigNumber.from(blockNumber).add(1)
                let endBlock = await rewardsManager.endBlock()
                let numBlocks = endBlock.sub(depositBlock)
                const pool = await rewardsManager.poolInfo(poolIndex)
                expect(pool.totalStaked).to.eq(totalSlpBalance)

                const deployerUser = await rewardsManager.userInfo(poolIndex, deployer.address)
                expect(deployerUser.amount).to.eq(deployerSlpBalance)
                expect(deployerUser.rewardTokenDebt).to.eq(0)
                expect(deployerUser.sushiRewardDebt).to.eq(deployerSlpBalance.mul(accSushiPerShare).div(FACTOR))

                multiplier = ethers.BigNumber.from(1)
                sushiReward = multiplier.mul(sushiPerBlock).mul(masterChefPoolAlloc).div(masterChefTotalAlloc)
                let masterChefSLPBalance = masterChefSLPBalanceBefore.add(deployerSlpBalance)
                accSushiPerShare = accSushiPerShare.add(sushiReward.mul(FACTOR).div(masterChefSLPBalance))
                let rmMultiplier = ethers.BigNumber.from(1)
                let edenReward = rmMultiplier.mul(rewardsPerBlock).mul(rmPoolAlloc).div(rmTotalAlloc)
                let totalSLPDeposited = rmSLPBalanceBefore.add(deployerSlpBalance)
                let accRewardsPerShare = rmPool.accRewardsPerShare.add(edenReward.mul(FACTOR).div(totalSLPDeposited))
                const aliceUser = await rewardsManager.userInfo(poolIndex, alice.address)
                expect(aliceUser.amount).to.eq(aliceSlpBalance)
                expect(aliceUser.rewardTokenDebt).to.eq(aliceSlpBalance.mul(accRewardsPerShare).div(FACTOR))
                expect(aliceUser.sushiRewardDebt).to.eq(aliceSlpBalance.mul(accSushiPerShare).div(FACTOR))

                masterChefSLPBalance = masterChefSLPBalance.add(aliceSlpBalance)
                accSushiPerShare = accSushiPerShare.add(sushiReward.mul(FACTOR).div(masterChefSLPBalance))
                totalSLPDeposited = totalSLPDeposited.add(aliceSlpBalance)
                accRewardsPerShare = accRewardsPerShare.add(edenReward.mul(FACTOR).div(totalSLPDeposited))
                const bobUser = await rewardsManager.userInfo(poolIndex, bob.address)
                expect(bobUser.amount).to.eq(bobSlpBalance)
                expect(bobUser.rewardTokenDebt).to.eq(bobSlpBalance.mul(accRewardsPerShare).div(FACTOR))
                expect(bobUser.sushiRewardDebt).to.eq(bobSlpBalance.mul(accSushiPerShare).div(FACTOR))
                
                expect(await lockManager.getAmountStaked(deployer.address, sushiPool.address)).to.eq(deployerSlpBalance)
                expect(await sushiPool.balanceOf(masterChef.address)).to.eq(masterChefSLPBalanceBefore.add(totalSlpBalance))
                expect(await votingPower.balanceOf(deployer.address)).to.eq(deployerSlpBalance.mul(SUSHI_LP_VP_CVR).div("1000000"))
                for(var i = 0; i < numBlocks.sub(1).toNumber(); i++) {
                    await ethers.provider.send("evm_mine")
                }
                let deployerPendingRewards = await rewardsManager.pendingRewardTokens(0, deployer.address)
                let deployerPendingSushi = await rewardsManager.pendingSushi(0, deployer.address)
                let alicePendingRewards = await rewardsManager.pendingRewardTokens(0, alice.address)
                let alicePendingSushi = await rewardsManager.pendingSushi(0, alice.address)
                let bobPendingRewards = await rewardsManager.pendingRewardTokens(0, bob.address)
                let bobPendingSushi = await rewardsManager.pendingSushi(0, bob.address)
                
                await rewardsManager.withdraw(poolIndex, deployerSlpBalance)
                
                let rmSushiBalanceAfter = await sushiToken.balanceOf(rewardsManager.address)
                const deployerEdenBalanceAfter = await edenToken.balanceOf(deployer.address)
                let vaultEdenBalanceAfter = await edenToken.balanceOf(vault.address)
                let totalEdenDistributed = deployerEdenBalanceAfter.add(vaultEdenBalanceAfter).sub(deployerEdenBalanceBefore)
                expect(totalEdenDistributed).to.eq(deployerPendingRewards)
                let rmEdenBalanceAfter = await edenToken.balanceOf(rewardsManager.address)
                let totalEdenRemoved = rmEdenBalanceAfter.sub(rmEdenBalanceBefore)
                expect(totalEdenDistributed.add(totalEdenRemoved)).to.eq(0)

                deployerPendingRewards = await rewardsManager.pendingRewardTokens(0, deployer.address)
                expect(deployerPendingRewards).to.eq(0)
                deployerPendingSushi = await rewardsManager.pendingSushi(0, deployer.address)
                expect(deployerPendingSushi).to.eq(0)
                alicePendingRewards = await rewardsManager.pendingRewardTokens(0, alice.address)
                alicePendingSushi = await rewardsManager.pendingSushi(0, alice.address)
                bobPendingRewards = await rewardsManager.pendingRewardTokens(0, bob.address)
                bobPendingSushi = await rewardsManager.pendingSushi(0, bob.address)

                await rewardsManager.connect(alice).withdraw(poolIndex, aliceSlpBalance)

                rmSushiBalanceAfter = await sushiToken.balanceOf(rewardsManager.address)
                const aliceEdenBalanceAfter = await edenToken.balanceOf(alice.address)
                vaultEdenBalance = vaultEdenBalanceAfter
                vaultEdenBalanceAfter = await edenToken.balanceOf(vault.address)
                let vaultDifference = vaultEdenBalanceAfter.sub(vaultEdenBalance)
                let edenDistributed = aliceEdenBalanceAfter.add(vaultDifference).sub(aliceEdenBalanceBefore)
                expect(edenDistributed).to.eq(alicePendingRewards)
                totalEdenDistributed = aliceEdenBalanceAfter.add(deployerEdenBalanceAfter).add(vaultEdenBalanceAfter).sub(deployerEdenBalanceBefore).sub(aliceEdenBalanceBefore)
                rmEdenBalanceAfter = await edenToken.balanceOf(rewardsManager.address)
                totalEdenRemoved = rmEdenBalanceAfter.sub(rmEdenBalanceBefore)
                expect(totalEdenDistributed.add(totalEdenRemoved)).to.eq(0)

                deployerPendingRewards = await rewardsManager.pendingRewardTokens(0, deployer.address)
                expect(deployerPendingRewards).to.eq(0)
                deployerPendingSushi = await rewardsManager.pendingSushi(0, deployer.address)
                expect(deployerPendingSushi).to.eq(0)
                alicePendingRewards = await rewardsManager.pendingRewardTokens(0, alice.address)
                expect(alicePendingRewards).to.eq(0)
                alicePendingSushi = await rewardsManager.pendingSushi(0, alice.address)
                expect(alicePendingSushi).to.eq(0)
                bobPendingRewards = await rewardsManager.pendingRewardTokens(0, bob.address)
                bobPendingSushi = await rewardsManager.pendingSushi(0, bob.address)


                await rewardsManager.connect(bob).withdraw(poolIndex, bobSlpBalance)
                rmSushiBalanceAfter = await sushiToken.balanceOf(rewardsManager.address)
                expect(rmSushiBalanceAfter).to.eq(0)
                const bobEdenBalanceAfter = await edenToken.balanceOf(bob.address)
                const allEdenBalancesBefore = deployerEdenBalanceBefore.add(aliceEdenBalanceBefore).add(bobEdenBalanceBefore)
                const allEdenBalancesAfter = bobEdenBalanceAfter.add(aliceEdenBalanceAfter).add(deployerEdenBalanceAfter)
                vaultEdenBalance = vaultEdenBalanceAfter
                vaultEdenBalanceAfter = await edenToken.balanceOf(vault.address)
                vaultDifference = vaultEdenBalanceAfter.sub(vaultEdenBalance)
                edenDistributed = bobEdenBalanceAfter.add(vaultDifference).sub(bobEdenBalanceBefore)
                expect(edenDistributed).to.eq(bobPendingRewards)
                totalEdenDistributed = allEdenBalancesAfter.add(vaultEdenBalanceAfter).sub(allEdenBalancesBefore)
                rmEdenBalanceAfter = await edenToken.balanceOf(rewardsManager.address)
                totalEdenRemoved = rmEdenBalanceAfter.sub(rmEdenBalanceBefore)
                expect(totalEdenDistributed.add(totalEdenRemoved)).to.eq(0)
                
                deployerPendingRewards = await rewardsManager.pendingRewardTokens(0, deployer.address)
                expect(deployerPendingRewards).to.eq(0)
                deployerPendingSushi = await rewardsManager.pendingSushi(0, deployer.address)
                expect(deployerPendingSushi).to.eq(0)
                alicePendingRewards = await rewardsManager.pendingRewardTokens(0, alice.address)
                expect(alicePendingRewards).to.eq(0)
                alicePendingSushi = await rewardsManager.pendingSushi(0, alice.address)
                expect(alicePendingSushi).to.eq(0)
                bobPendingRewards = await rewardsManager.pendingRewardTokens(0, bob.address)
                expect(bobPendingRewards).to.eq(0)
                bobPendingSushi = await rewardsManager.pendingSushi(0, bob.address)
                expect(bobPendingSushi).to.eq(0)
            })
        })
    })
  })