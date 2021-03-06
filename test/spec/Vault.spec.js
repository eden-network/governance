const { expect } = require("chai");
const { ethers } = require("hardhat");
const { rewardsFixture } = require("../fixtures")
const { ecsign } = require("ethereumjs-util")

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY

const DOMAIN_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
)

const PERMIT_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

describe("Vault", function() {
    let edenToken
    let vault
    let lockManager
    let deployer
    let alice
    let bob
    let ZERO_ADDRESS

    beforeEach(async () => {
        const fix = await rewardsFixture()
        edenToken = fix.edenToken
        vault = fix.vault
        lockManager = fix.lockManager
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        ZERO_ADDRESS = fix.ZERO_ADDRESS
        await lockManager.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LOCKER_ROLE")), vault.address)
    })

    context("lockTokens", async () => {
        it("creates valid lock of Eden tokens", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.lockTokens(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, DURATION_IN_DAYS, true)
            const activeLocks = await vault.activeLocks(alice.address)
            const newLock = activeLocks[0]
            expect(newLock[0]).to.eq(edenToken.address)
            expect(newLock[1]).to.eq(alice.address)
            expect(newLock[2]).to.eq(START_TIME)
            expect(newLock[3]).to.eq(DURATION_IN_DAYS)
            expect(newLock[4]).to.eq(DURATION_IN_DAYS)
            expect(newLock[5]).to.eq(lockAmount)
            expect(newLock[6]).to.eq(0)
            expect(newLock[7]).to.eq(lockAmount)
            totalLocked = totalLocked.add(lockAmount)
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
        })

        it("does not allow a lock with a duration of 0", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 0
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await expect(vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, DURATION_IN_DAYS, false)).to.revertedWith("revert Vault::lockTokens: vesting duration must be > 0")
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
            const emptyLocks = await vault.activeLocks(bob.address)
            expect(emptyLocks.length).to.eq(0)
        })

        it("does not allow a lock with a duration of > 25 years", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 26 * 365
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await expect(vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, DURATION_IN_DAYS, false)).to.revertedWith("revert Vault::lockTokens: vesting duration more than 25 years")
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
            const emptyLocks = await vault.activeLocks(bob.address)
            expect(emptyLocks.length).to.eq(0)
        })

        it("does not allow a lock of 0", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(0).mul(ethers.BigNumber.from(10).pow(decimals))
            await expect(vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, DURATION_IN_DAYS, false)).to.revertedWith("revert Vault::lockTokens: amount not > 0")
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
            const emptyLocks = await vault.activeLocks(bob.address)
            expect(emptyLocks.length).to.eq(0)
        })

        it("does not allow a lock when locker has insufficient balance", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            await edenToken.transfer(bob.address, await edenToken.balanceOf(deployer.address))
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await expect(vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, DURATION_IN_DAYS, false)).to.revertedWith("revert Eden::_transferTokens: transfer exceeds from balance")
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
            const emptyLocks = await vault.activeLocks(bob.address)
            expect(emptyLocks.length).to.eq(0)
        })
    })

    context("lockTokensWithPermit", async () => {
        xit("creates valid lock of Eden tokens", async function() {
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            const domainSeparator = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                  [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, edenToken.address]
                )
            )
      
            const nonce = await edenToken.nonces(deployer.address)
            const deadline = ethers.constants.MaxUint256
            const digest = ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                    [
                    '0x19',
                    '0x01',
                    domainSeparator,
                    ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                        [PERMIT_TYPEHASH, deployer.address, vault.address, lockAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
            
            await vault.lockTokensWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)
            const activeLocks = await vault.activeLocks(alice.address)
            const newLock = activeLocks[0]
            expect(newLock[0]).to.eq(edenToken.address)
            expect(newLock[1]).to.eq(alice.address)
            expect(newLock[2]).to.eq(START_TIME)
            expect(newLock[3]).to.eq(DURATION_IN_DAYS)
            expect(newLock[4]).to.eq(0)
            expect(newLock[5]).to.eq(lockAmount)
            expect(newLock[6]).to.eq(0)
            expect(newLock[7]).to.eq(0)
            totalLocked = totalLocked.add(lockAmount)
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
        })

        xit("does not allow a lock with a duration of 0", async function() {
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 0
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            const domainSeparator = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                  [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, edenToken.address]
                )
            )
      
            const nonce = await edenToken.nonces(deployer.address)
            const deadline = ethers.constants.MaxUint256
            const digest = ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                    [
                    '0x19',
                    '0x01',
                    domainSeparator,
                    ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                        [PERMIT_TYPEHASH, deployer.address, vault.address, lockAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
            
            await expect(vault.lockTokensWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)).to.revertedWith("revert Vault::lockTokensWithPermit: vesting duration must be > 0")
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
            const emptyLocks = await vault.activeLocks(bob.address)
            expect(emptyLocks.length).to.eq(0)
        })

        xit("does not allow a lock with a duration of > 25 years", async function() {
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 26 * 365
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            const domainSeparator = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                  [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, edenToken.address]
                )
            )
      
            const nonce = await edenToken.nonces(deployer.address)
            const deadline = ethers.constants.MaxUint256
            const digest = ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                    [
                    '0x19',
                    '0x01',
                    domainSeparator,
                    ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                        [PERMIT_TYPEHASH, deployer.address, vault.address, lockAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
    
            await expect(vault.lockTokensWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)).to.revertedWith("revert Vault::lockTokensWithPermit: vesting duration more than 25 years")
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
            const emptyLocks = await vault.activeLocks(bob.address)
            expect(emptyLocks.length).to.eq(0)
        })

        xit("does not allow a lock of 0", async function() {
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(0)
            const domainSeparator = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                  [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, edenToken.address]
                )
            )
      
            const nonce = await edenToken.nonces(deployer.address)
            const deadline = ethers.constants.MaxUint256
            const digest = ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                    [
                    '0x19',
                    '0x01',
                    domainSeparator,
                    ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                        [PERMIT_TYPEHASH, deployer.address, vault.address, lockAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
            await expect(vault.lockTokensWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)).to.revertedWith("revert Vault::lockTokensWithPermit: amount not > 0")
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
            const emptyLocks = await vault.activeLocks(bob.address)
            expect(emptyLocks.length).to.eq(0)
        })

        xit("does not allow a lock when locker has insufficient balance", async function() {
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            let totalLocked = await edenToken.balanceOf(vault.address)
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            const domainSeparator = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                  [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), ethers.provider.network.chainId, edenToken.address]
                )
            )
      
            const nonce = await edenToken.nonces(deployer.address)
            const deadline = ethers.constants.MaxUint256
            const digest = ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
                    [
                    '0x19',
                    '0x01',
                    domainSeparator,
                    ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                        [PERMIT_TYPEHASH, deployer.address, vault.address, lockAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
            
            
            await edenToken.transfer(bob.address, await edenToken.balanceOf(deployer.address))
            await expect(vault.lockTokensWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)).to.revertedWith("revert Eden::_transferTokens: transfer exceeds from balance")
            expect(await edenToken.balanceOf(vault.address)).to.eq(totalLocked)
            const emptyLocks = await vault.activeLocks(bob.address)
            expect(emptyLocks.length).to.eq(0)
        })
    })

    context("tokenBalance", async () => {
        it("returns 0 if locked token balance does not exist", async function() {
          await edenToken.approve(vault.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
          const balance = await vault.tokenBalance(ZERO_ADDRESS, bob.address)
          expect(balance.totalAmount).to.eq(0)
          expect(balance.claimableAmount).to.eq(0)
          expect(balance.claimedAmount).to.eq(0)
          expect(balance.votingPower).to.eq(0)
        })
  
        it("returns total as claimable amount after lock duration has ended", async function() {
          await edenToken.approve(vault.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
          await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
          await ethers.provider.send("evm_mine")
          const balance = await vault.tokenBalance(edenToken.address, bob.address)
          expect(balance.totalAmount).to.eq(lockAmount)
          expect(balance.claimableAmount).to.eq(lockAmount)
          expect(balance.claimedAmount).to.eq(0)
          expect(balance.votingPower).to.eq(0)
        })
  
        it("returns 0 claimable if before duration has ended", async function() {
          await edenToken.approve(vault.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
          const balance = await vault.tokenBalance(edenToken.address, bob.address)
          expect(balance.totalAmount).to.eq(lockAmount)
          expect(balance.claimableAmount).to.eq(0)
          expect(balance.claimedAmount).to.eq(0)
          expect(balance.votingPower).to.eq(0)
        })

        it("returns 0 tokens as claimable if before duration has ended (multiple balances)", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
            await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
            const balance = await vault.tokenBalance(edenToken.address, bob.address)
            expect(balance.totalAmount).to.eq(lockAmount.mul(2))
            expect(balance.claimableAmount).to.eq(0)
            expect(balance.claimedAmount).to.eq(0)
            expect(balance.votingPower).to.eq(0)
        })

        it("returns correct locked tokens for balances at different stages (multiple)", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, DURATION_IN_DAYS, false)
            await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS * 2, DURATION_IN_DAYS * 2, false)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
            await ethers.provider.send("evm_mine")
            const balance = await vault.tokenBalance(edenToken.address, bob.address)
            expect(balance.totalAmount).to.eq(lockAmount.mul(2))
            expect(balance.claimableAmount).to.eq(lockAmount)
            expect(balance.claimedAmount).to.eq(0)
            expect(balance.votingPower).to.eq(0)
        })
    })

    context("claimableBalance", async () => {
      it("returns 0 before lock start time", async function() {
        await edenToken.approve(vault.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
        expect(await vault.claimableBalance(0)).to.eq(0)
      })

      it("returns 0 at start time", async function() {
        await edenToken.approve(vault.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME])
        await ethers.provider.send("evm_mine")
        expect(await vault.claimableBalance(0)).to.eq(0)
      })

      it("returns 0 if cliff has yet to pass", async function() {
        await edenToken.approve(vault.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const CLIFF_DURATION_IN_DAYS = 2
        const CLIFF_DURATION_IN_SECS = CLIFF_DURATION_IN_DAYS * 24 * 60 * 60
        let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, CLIFF_DURATION_IN_DAYS, false)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + CLIFF_DURATION_IN_SECS - 1])
        await ethers.provider.send("evm_mine")
        expect(await vault.claimableBalance(0)).to.eq(0)
      })

      it("returns vested amount cliff has passed", async function() {
        await edenToken.approve(vault.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        const CLIFF_DURATION_IN_DAYS = 2
        const CLIFF_DURATION_IN_SECS = CLIFF_DURATION_IN_DAYS * 24 * 60 * 60
        let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, CLIFF_DURATION_IN_DAYS, false)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + CLIFF_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        const vestedAmountPerSec = lockAmount.div(DURATION_IN_SECS)
        const vestedAmount = vestedAmountPerSec.mul(CLIFF_DURATION_IN_SECS)
        expect(await vault.claimableBalance(0)).to.eq(vestedAmount)
      })

      it("returns total unlocked tokens if after duration and none claimed", async function() {
        await edenToken.approve(vault.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await vault.claimableBalance(0)).to.eq(lockAmount)
      })

      it("returns remaining unlocked tokens if after duration and some claimed", async function() {
        await edenToken.approve(vault.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
        let claimAmount = ethers.BigNumber.from(100).mul(ethers.BigNumber.from(10).pow(decimals))
        await vault.connect(bob).claimUnlockedTokenAmounts([0], [claimAmount])
        expect(await vault.claimableBalance(0)).to.eq(lockAmount.sub(claimAmount))
      })
    })

    context("claimUnlockedTokenAmounts", async () => {
        it("does not allow user to claim if no tokens are unlocked", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
            await expect(vault.connect(bob).claimUnlockedTokenAmounts([0], [lockAmount])).to.revertedWith("revert Vault::claimUnlockedTokenAmounts: claimableAmount < amount")
        })

        it("allows user to claim unlocked tokens once", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.lockTokens(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
            let userTokenBalanceBefore = await edenToken.balanceOf(alice.address)
            let contractTokenBalanceBefore = await edenToken.balanceOf(vault.address)
            let newTime = timestamp + 21600 + DURATION_IN_SECS + 60
            await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
            await vault.connect(alice).claimUnlockedTokenAmounts([0], [lockAmount])
            expect(await vault.claimableBalance(0)).to.eq(0)
            expect(await edenToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(lockAmount))
            expect(await edenToken.balanceOf(vault.address)).to.eq(contractTokenBalanceBefore.sub(lockAmount))
        })

        it("allows user to claim unlocked tokens multiple times", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            const aliceBalanceBefore = await edenToken.balanceOf(alice.address)
            await vault.lockTokens(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
            let userTokenBalanceBefore = await edenToken.balanceOf(alice.address)
            let contractTokenBalanceBefore = await edenToken.balanceOf(vault.address)
            let newTime = timestamp + 21600 + DURATION_IN_SECS + 60
            await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
            let claimAmount = ethers.BigNumber.from(100).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.connect(alice).claimUnlockedTokenAmounts([0], [claimAmount])
            expect(await vault.claimableBalance(0)).to.eq(lockAmount.sub(claimAmount))
            expect(await edenToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(claimAmount))
            expect(await edenToken.balanceOf(vault.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount))
            
            await vault.connect(alice).claimUnlockedTokenAmounts([0], [claimAmount])
            expect(await vault.claimableBalance(0)).to.eq(lockAmount.sub(claimAmount.mul(2)))
            expect(await edenToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(claimAmount.mul(2)))
            expect(await edenToken.balanceOf(vault.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount.mul(2)))
            
            await vault.connect(alice).claimUnlockedTokenAmounts([0], [lockAmount.sub(claimAmount.mul(2))])
            expect(await vault.claimableBalance(0)).to.eq(0)
            expect(await edenToken.balanceOf(alice.address)).to.eq(aliceBalanceBefore.add(lockAmount))
            expect(await edenToken.balanceOf(vault.address)).to.eq(0)
        })
    })

    context("claimAllUnlockedTokens", async () => {
        it("does not allow user to claim if no tokens are unlocked", async function() {
          await edenToken.approve(vault.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
          await expect(vault.connect(bob).claimAllUnlockedTokens([0])).to.revertedWith("revert Vault::claimAllUnlockedTokens: claimableAmount is 0")
        })
  
        it("allows user to claim unlocked tokens once", async function() {
          await edenToken.approve(vault.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await vault.lockTokens(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)
          let userTokenBalanceBefore = await edenToken.balanceOf(alice.address)
          let contractTokenBalanceBefore = await edenToken.balanceOf(vault.address)
          let newTime = timestamp + 21600 + DURATION_IN_SECS + 60
          await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
          await vault.connect(alice).claimAllUnlockedTokens([0])
          expect(await vault.claimableBalance(0)).to.eq(0)
          expect(await edenToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(lockAmount))
          expect(await edenToken.balanceOf(vault.address)).to.eq(contractTokenBalanceBefore.sub(lockAmount))
        })
  
        it("does not allow user to claim unlocked tokens multiple times", async function() {
          await edenToken.approve(vault.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          const aliceBalanceBefore = await edenToken.balanceOf(alice.address)
          let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await vault.lockTokens(edenToken.address, deployer.address, alice.address, START_TIME, lockAmount, DURATION_IN_DAYS, 0, false)

          let newTime = timestamp + 21600 + DURATION_IN_SECS + 60
          await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        
          await vault.connect(alice).claimAllUnlockedTokens([0])
          expect(await vault.claimableBalance(0)).to.eq(0)
          expect(await edenToken.balanceOf(alice.address)).to.eq(aliceBalanceBefore.add(lockAmount))
          expect(await edenToken.balanceOf(vault.address)).to.eq(0)

          await expect(vault.connect(alice).claimAllUnlockedTokens([0])).to.revertedWith("revert Vault::claimAllUnlockedTokens: claimableAmount is 0")
        })
    })

    context("extendLock", async () => {
        it("allows receiver to extend a lock", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const ORIGINAL_DURATION_IN_DAYS = 4
            const SIX_MONTHS_IN_DAYS = 6 * 30
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, ORIGINAL_DURATION_IN_DAYS, 0, false)
            let lock = await vault.tokenLocks(0)
            expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS)

            await vault.connect(bob).extendLock(0, SIX_MONTHS_IN_DAYS, 0)

            lock = await vault.tokenLocks(0)
            expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS + SIX_MONTHS_IN_DAYS)
        })

        it("does not allow non-receiver to extend a lock", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const ORIGINAL_DURATION_IN_DAYS = 4
            const SIX_MONTHS_IN_DAYS = 6 * 30
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, ORIGINAL_DURATION_IN_DAYS, 0, false)
            let lock = await vault.tokenLocks(0)
            expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS)

            await expect(vault.extendLock(0, SIX_MONTHS_IN_DAYS, 0)).to.revertedWith("Vault::extendLock: msg.sender must be receiver")
            
            lock = await vault.tokenLocks(0)
            expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS)
        })

        it("does not allow receiver to overflow lock", async function() {
            await edenToken.approve(vault.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const ORIGINAL_DURATION_IN_DAYS = 4
            let lockAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await vault.lockTokens(edenToken.address, deployer.address, bob.address, START_TIME, lockAmount, ORIGINAL_DURATION_IN_DAYS, 0, false)
            let lock = await vault.tokenLocks(0)
            expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS)

            await expect(vault.connect(bob).extendLock(0, 65535, 0)).to.revertedWith("revert Vault::extendLock: vesting max days exceeded")
            
            lock = await vault.tokenLocks(0)
            expect(lock.vestingDurationInDays).to.eq(ORIGINAL_DURATION_IN_DAYS)
        })

    })
})
