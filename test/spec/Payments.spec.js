const { expect } = require("chai");
const { ethers } = require("hardhat");
const { paymentsFixture } = require("../fixtures")
const { ecsign } = require("ethereumjs-util")

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY

const DOMAIN_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
)

const PERMIT_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

describe("Payments", function() {
    let edenToken
    let payments
    let deployer
    let alice
    let bob
    let ZERO_ADDRESS

    beforeEach(async () => {
        const fix = await paymentsFixture()
        edenToken = fix.edenToken
        payments = fix.payments
        deployer = fix.deployer
        alice = fix.alice
        bob = fix.bob
        ZERO_ADDRESS = fix.ZERO_ADDRESS
    })

    context("createPayment", async () => {
        it("creates valid payment of Eden tokens", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, DURATION_IN_DAYS)
            const alicePayments = await payments.allPayments(alice.address)
            const newPayment = alicePayments[0]
            expect(newPayment[0]).to.eq(edenToken.address)
            expect(newPayment[1]).to.eq(alice.address)
            expect(newPayment[2]).to.eq(deployer.address)
            expect(newPayment[3]).to.eq(START_TIME)
            expect(newPayment[4]).to.eq(0)
            expect(newPayment[5]).to.eq(DURATION_IN_DAYS)
            expect(newPayment[6]).to.eq(DURATION_IN_SECS)
            expect(newPayment[7]).to.eq(paymentAmount)
            expect(newPayment[8]).to.eq(0)
            totalPayment = totalPayment.add(paymentAmount)
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
        })

        it("does not allow a payment with a duration of 0", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 0
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await expect(payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, DURATION_IN_DAYS)).to.revertedWith("Payments::createPayment: payment duration must be > 0")
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
            const emptyPayments = await payments.activePayments(bob.address)
            expect(emptyPayments.length).to.eq(0)
        })

        it("does not allow a payment with a duration of > 25 years", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 26 * 365
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await expect(payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, DURATION_IN_DAYS)).to.revertedWith("Payments::createPayment: payment duration more than 25 years")
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
            const emptyPayments = await payments.activePayments(bob.address)
            expect(emptyPayments.length).to.eq(0)
        })

        it("does not allow a payment of 0", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(0).mul(ethers.BigNumber.from(10).pow(decimals))
            await expect(payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, DURATION_IN_DAYS)).to.revertedWith("Payments::createPayment: amount not > 0")
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
            const emptyPayments = await payments.activePayments(bob.address)
            expect(emptyPayments.length).to.eq(0)
        })

        it("does not allow a payment when payer has insufficient balance", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            await edenToken.transfer(bob.address, await edenToken.balanceOf(deployer.address))
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await expect(payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, DURATION_IN_DAYS)).to.reverted
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
            const emptyPayments = await payments.activePayments(bob.address)
            expect(emptyPayments.length).to.eq(0)
        })
    })

    context("createPaymentWithPermit", async () => {
        xit("creates valid payment of Eden tokens", async function() {
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
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
                        [PERMIT_TYPEHASH, deployer.address, payments.address, paymentAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
            
            await payments.createPaymentWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0, deadline, v, r, s)
            const alicePayments = await payments.allPayments(alice.address)
            const newPayment = alicePayments[0]
            expect(newPayment[0]).to.eq(edenToken.address)
            expect(newPayment[1]).to.eq(alice.address)
            expect(newPayment[2]).to.eq(deployer.address)
            expect(newPayment[3]).to.eq(START_TIME)
            expect(newPayment[4]).to.eq(0)
            expect(newPayment[5]).to.eq(DURATION_IN_SECS)
            expect(newPayment[6]).to.eq(paymentAmount)
            expect(newPayment[7]).to.eq(0)
            totalPayment = totalPayment.add(paymentAmount)
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
        })

        xit("does not allow a payment with a duration of 0", async function() {
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 0
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
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
                        [PERMIT_TYPEHASH, deployer.address, payments.address, paymentAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
            
            await expect(payments.createPaymentWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)).to.revertedWith("Payments::createPaymentWithPermit: payment duration must be > 0")
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
            const emptyPayments = await payments.activePayments(bob.address)
            expect(emptyPayments.length).to.eq(0)
        })

        xit("does not allow a payment with a duration of > 25 years", async function() {
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 26 * 365
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
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
                        [PERMIT_TYPEHASH, deployer.address, payments.address, paymentAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
    
            await expect(payments.createPaymentWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)).to.revertedWith("Payments::createPaymentWithPermit: payment duration more than 25 years")
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
            const emptyPayments = await payments.activePayments(bob.address)
            expect(emptyPayments.length).to.eq(0)
        })

        xit("does not allow a payment of 0", async function() {
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(0)
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
                        [PERMIT_TYPEHASH, deployer.address, payments.address, paymentAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
            await expect(payments.createPaymentWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)).to.revertedWith("Payments::createPaymentWithPermit: amount not > 0")
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
            const emptyPayments = await payments.activePayments(bob.address)
            expect(emptyPayments.length).to.eq(0)
        })

        xit("does not allow a payment when payer has insufficient balance", async function() {
            let decimals = await edenToken.decimals()
            const START_TIME = parseInt(Date.now() / 1000) + 21600
            const DURATION_IN_DAYS = 4
            let totalPayment = await edenToken.balanceOf(payments.address)
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
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
                        [PERMIT_TYPEHASH, deployer.address, payments.address, paymentAmount, nonce, deadline]
                        )
                    ),
                    ]
                )
            )
    
            const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
            
            
            await edenToken.transfer(bob.address, await edenToken.balanceOf(deployer.address))
            await expect(payments.createPaymentWithPermit(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_DAYS, 0, false, deadline, v, r, s)).to.revertedWith("Eden::_transferTokens: transfer exceeds from balance")
            expect(await edenToken.balanceOf(payments.address)).to.eq(totalPayment)
            const emptyPayments = await payments.activePayments(bob.address)
            expect(emptyPayments.length).to.eq(0)
        })
    })

    context("tokenBalance", async () => {
        it("returns 0 if token balance does not exist", async function() {
          await edenToken.approve(payments.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
          const balance = await payments.tokenBalance(ZERO_ADDRESS, bob.address)
          expect(balance.totalAmount).to.eq(0)
          expect(balance.claimableAmount).to.eq(0)
          expect(balance.claimedAmount).to.eq(0)
        })
  
        it("returns total as claimable amount after payment duration has ended", async function() {
          await edenToken.approve(payments.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
          await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
          await ethers.provider.send("evm_mine")
          const balance = await payments.tokenBalance(edenToken.address, bob.address)
          expect(balance.totalAmount).to.eq(paymentAmount)
          expect(balance.claimableAmount).to.eq(paymentAmount)
          expect(balance.claimedAmount).to.eq(0)
        })
  
        it("returns 0 claimable if before duration has ended", async function() {
          await edenToken.approve(payments.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
          const balance = await payments.tokenBalance(edenToken.address, bob.address)
          expect(balance.totalAmount).to.eq(paymentAmount)
          expect(balance.claimableAmount).to.eq(0)
          expect(balance.claimedAmount).to.eq(0)
        })

        it("returns 0 tokens as claimable if before duration has ended (multiple balances)", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            const balance = await payments.tokenBalance(edenToken.address, bob.address)
            expect(balance.totalAmount).to.eq(paymentAmount.mul(2))
            expect(balance.claimableAmount).to.eq(0)
            expect(balance.claimedAmount).to.eq(0)
        })

        it("returns correct tokens for balances at different stages (multiple)", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, DURATION_IN_DAYS)
            await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS * 2, DURATION_IN_DAYS * 2)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
            await ethers.provider.send("evm_mine")
            const balance = await payments.tokenBalance(edenToken.address, bob.address)
            expect(balance.totalAmount).to.eq(paymentAmount.mul(2))
            expect(balance.claimableAmount).to.eq(paymentAmount)
            expect(balance.claimedAmount).to.eq(0)
        })
    })

    context("claimableBalance", async () => {
      it("returns 0 before payment start time", async function() {
        await edenToken.approve(payments.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
        expect(await payments.claimableBalance(0)).to.eq(0)
      })

      it("returns 0 at start time", async function() {
        await edenToken.approve(payments.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME])
        await ethers.provider.send("evm_mine")
        expect(await payments.claimableBalance(0)).to.eq(0)
      })

      it("returns 0 if cliff has yet to pass", async function() {
        await edenToken.approve(payments.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        const CLIFF_DURATION_IN_DAYS = 2
        const CLIFF_DURATION_IN_SECS = CLIFF_DURATION_IN_DAYS * 24 * 60 * 60
        let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, CLIFF_DURATION_IN_DAYS)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + CLIFF_DURATION_IN_SECS - 1])
        await ethers.provider.send("evm_mine")
        expect(await payments.claimableBalance(0)).to.eq(0)
      })

      it("returns vested amount cliff has passed", async function() {
        await edenToken.approve(payments.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        const CLIFF_DURATION_IN_DAYS = 2
        const CLIFF_DURATION_IN_SECS = CLIFF_DURATION_IN_DAYS * 24 * 60 * 60
        let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, CLIFF_DURATION_IN_DAYS)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + CLIFF_DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        const vestedAmountPerSec = paymentAmount.div(DURATION_IN_SECS)
        const vestedAmount = vestedAmountPerSec.mul(CLIFF_DURATION_IN_SECS)
        expect(await payments.claimableBalance(0)).to.eq(vestedAmount)
      })

      it("returns total available tokens if after duration and none claimed", async function() {
        await edenToken.approve(payments.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
        await ethers.provider.send("evm_mine")
        expect(await payments.claimableBalance(0)).to.eq(paymentAmount)
      })

      it("returns remaining available tokens if after duration and some claimed", async function() {
        await edenToken.approve(payments.address, ethers.constants.MaxUint256)
        let decimals = await edenToken.decimals()
        const { timestamp } = await ethers.provider.getBlock('latest')
        const START_TIME = timestamp + 21600
        const DURATION_IN_DAYS = 4
        const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
        let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
        await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
        await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
        let claimAmount = ethers.BigNumber.from(100).mul(ethers.BigNumber.from(10).pow(decimals))
        await payments.connect(bob).claimAvailableTokenAmounts([0], [claimAmount])
        expect(await payments.claimableBalance(0)).to.eq(paymentAmount.sub(claimAmount))
      })
    })

    context("claimAvailableTokenAmounts", async () => {
        it("does not allow user to claim if no tokens are available", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            await expect(payments.connect(bob).claimAvailableTokenAmounts([0], [paymentAmount])).to.revertedWith("Payments::claimAvailableTokenAmounts: claimableAmount < amount")
        })

        it("allows user to claim available tokens once", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let userTokenBalanceBefore = await edenToken.balanceOf(alice.address)
            let contractTokenBalanceBefore = await edenToken.balanceOf(payments.address)
            let newTime = timestamp + 21600 + DURATION_IN_SECS + 60
            await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
            await payments.connect(alice).claimAvailableTokenAmounts([0], [paymentAmount])
            expect(await payments.claimableBalance(0)).to.eq(0)
            expect(await edenToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(paymentAmount))
            expect(await edenToken.balanceOf(payments.address)).to.eq(contractTokenBalanceBefore.sub(paymentAmount))
        })

        it("allows user to claim available tokens multiple times", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            const aliceBalanceBefore = await edenToken.balanceOf(alice.address)
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let userTokenBalanceBefore = await edenToken.balanceOf(alice.address)
            let contractTokenBalanceBefore = await edenToken.balanceOf(payments.address)
            let newTime = timestamp + 21600 + DURATION_IN_SECS + 60
            await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
            let claimAmount = ethers.BigNumber.from(100).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.connect(alice).claimAvailableTokenAmounts([0], [claimAmount])
            expect(await payments.claimableBalance(0)).to.eq(paymentAmount.sub(claimAmount))
            expect(await edenToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(claimAmount))
            expect(await edenToken.balanceOf(payments.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount))
            
            await payments.connect(alice).claimAvailableTokenAmounts([0], [claimAmount])
            expect(await payments.claimableBalance(0)).to.eq(paymentAmount.sub(claimAmount.mul(2)))
            expect(await edenToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(claimAmount.mul(2)))
            expect(await edenToken.balanceOf(payments.address)).to.eq(contractTokenBalanceBefore.sub(claimAmount.mul(2)))
            
            await payments.connect(alice).claimAvailableTokenAmounts([0], [paymentAmount.sub(claimAmount.mul(2))])
            expect(await payments.claimableBalance(0)).to.eq(0)
            expect(await edenToken.balanceOf(alice.address)).to.eq(aliceBalanceBefore.add(paymentAmount))
            expect(await edenToken.balanceOf(payments.address)).to.eq(0)
        })
    })

    context("claimAllAvailableTokens", async () => {
        it("does not allow user to claim if no tokens are available", async function() {
          await edenToken.approve(payments.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await payments.createPayment(edenToken.address, deployer.address, bob.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
          await expect(payments.connect(bob).claimAllAvailableTokens([0])).to.revertedWith("Payments::claimAllAvailableTokens: claimableAmount is 0")
        })
  
        it("allows user to claim available tokens once", async function() {
          await edenToken.approve(payments.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
          let userTokenBalanceBefore = await edenToken.balanceOf(alice.address)
          let contractTokenBalanceBefore = await edenToken.balanceOf(payments.address)
          let newTime = timestamp + 21600 + DURATION_IN_SECS + 60
          await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
          await payments.connect(alice).claimAllAvailableTokens([0])
          expect(await payments.claimableBalance(0)).to.eq(0)
          expect(await edenToken.balanceOf(alice.address)).to.eq(userTokenBalanceBefore.add(paymentAmount))
          expect(await edenToken.balanceOf(payments.address)).to.eq(contractTokenBalanceBefore.sub(paymentAmount))
        })
  
        it("does not allow user to claim available tokens multiple times", async function() {
          await edenToken.approve(payments.address, ethers.constants.MaxUint256)
          let decimals = await edenToken.decimals()
          const { timestamp } = await ethers.provider.getBlock('latest')
          const START_TIME = timestamp + 21600
          const DURATION_IN_DAYS = 4
          const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
          const aliceBalanceBefore = await edenToken.balanceOf(alice.address)
          let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
          await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)

          let newTime = timestamp + 21600 + DURATION_IN_SECS + 60
          await ethers.provider.send("evm_setNextBlockTimestamp", [newTime])
        
          await payments.connect(alice).claimAllAvailableTokens([0])
          expect(await payments.claimableBalance(0)).to.eq(0)
          expect(await edenToken.balanceOf(alice.address)).to.eq(aliceBalanceBefore.add(paymentAmount))
          expect(await edenToken.balanceOf(payments.address)).to.eq(0)

          await expect(payments.connect(alice).claimAllAvailableTokens([0])).to.revertedWith("Payments::claimAllAvailableTokens: claimableAmount is 0")
        })
    })

    context("stopPayment", async () => {
        it("payer can stop a payment before start time", async function() {
            const balanceBefore = await edenToken.balanceOf(deployer.address)
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let alicePayments = await payments.allPayments(alice.address)
            let payment = alicePayments[0]
            expect(payment[0]).to.eq(edenToken.address)
            expect(payment[1]).to.eq(alice.address)
            expect(payment[2]).to.eq(deployer.address)
            expect(payment[3]).to.eq(START_TIME)
            expect(payment[4]).to.eq(0)
            expect(payment[5]).to.eq(0)
            expect(payment[6]).to.eq(DURATION_IN_SECS)
            expect(payment[7]).to.eq(paymentAmount)
            expect(payment[8]).to.eq(0)
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore.sub(paymentAmount))
            await payments.stopPayment(0, 0)
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore)
            let paymentBalance = await payments.paymentBalance(0)
            payment = paymentBalance[2]
            expect(payment[5]).to.eq(0)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + 100000])
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            expect(await payments.claimableBalance(0)).to.eq(0)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
            expect(await payments.claimableBalance(0)).to.eq(0)
            expect(await edenToken.balanceOf(payments.address)).to.eq(0)
        })

        it("receiver can stop a payment before start time", async function() {
            const balanceBefore = await edenToken.balanceOf(deployer.address)
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let alicePayments = await payments.allPayments(alice.address)
            let payment = alicePayments[0]
            expect(payment[0]).to.eq(edenToken.address)
            expect(payment[1]).to.eq(alice.address)
            expect(payment[2]).to.eq(deployer.address)
            expect(payment[3]).to.eq(START_TIME)
            expect(payment[4]).to.eq(0)
            expect(payment[5]).to.eq(0)
            expect(payment[6]).to.eq(DURATION_IN_SECS)
            expect(payment[7]).to.eq(paymentAmount)
            expect(payment[8]).to.eq(0)
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore.sub(paymentAmount))
            await payments.connect(alice).stopPayment(0, 0)
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore)
            let paymentBalance = await payments.paymentBalance(0)
            payment = paymentBalance[2]
            expect(payment[5]).to.eq(0)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + 100000])
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            expect(await payments.claimableBalance(0)).to.eq(0)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
            expect(await payments.claimableBalance(0)).to.eq(0)
            expect(await edenToken.balanceOf(payments.address)).to.eq(0)
        })

        it("payer can stop a payment after start time", async function() {
            const balanceBefore = await edenToken.balanceOf(deployer.address)
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            const paymentAmountPerSec = paymentAmount.div(DURATION_IN_SECS)
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            let alicePayments = await payments.allPayments(alice.address)
            let payment = alicePayments[0]
            expect(payment[0]).to.eq(edenToken.address)
            expect(payment[1]).to.eq(alice.address)
            expect(payment[2]).to.eq(deployer.address)
            expect(payment[3]).to.eq(START_TIME)
            expect(payment[4]).to.eq(0)
            expect(payment[5]).to.eq(0)
            expect(payment[6]).to.eq(DURATION_IN_SECS)
            expect(payment[7]).to.eq(paymentAmount)
            expect(payment[8]).to.eq(0)
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore.sub(paymentAmount))
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + 99999])
            await ethers.provider.send("evm_mine")
            expect(await payments.claimableBalance(0)).to.be.gt(0)
            await payments.stopPayment(0, 0)
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.not.be.empty
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore.sub(paymentAmountPerSec.mul(100000)))
            let paymentBalance = await payments.paymentBalance(0)
            payment = paymentBalance[2]
            expect(payment[4]).to.eq(START_TIME + 100000)
            await payments.connect(alice).claimAllAvailableTokens([0])
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            expect(await edenToken.balanceOf(alice.address)).to.eq(paymentAmountPerSec.mul(100000))
            expect(await edenToken.balanceOf(payments.address)).to.eq(0)
        })

        it("receiver can stop a payment after start time", async function() {
            const balanceBefore = await edenToken.balanceOf(deployer.address)
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let alicePayments = await payments.allPayments(alice.address)
            let payment = alicePayments[0]
            expect(payment[0]).to.eq(edenToken.address)
            expect(payment[1]).to.eq(alice.address)
            expect(payment[2]).to.eq(deployer.address)
            expect(payment[3]).to.eq(START_TIME)
            expect(payment[4]).to.eq(0)
            expect(payment[5]).to.eq(0)
            expect(payment[6]).to.eq(DURATION_IN_SECS)
            expect(payment[7]).to.eq(paymentAmount)
            expect(payment[8]).to.eq(0)
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore.sub(paymentAmount))
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + 100000])
            await payments.connect(alice).stopPayment(0, 0)
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.not.be.empty
            expect(await edenToken.balanceOf(deployer.address)).to.be.lt(balanceBefore)
            expect(await edenToken.balanceOf(deployer.address)).to.be.gt(balanceBefore.sub(paymentAmount))
            let paymentBalance = await payments.paymentBalance(0)
            payment = paymentBalance[2]
            expect(payment[4]).to.eq(START_TIME + 100000)
            await payments.connect(alice).claimAllAvailableTokens([0])
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            expect(await edenToken.balanceOf(alice.address)).to.be.gt(0)
            expect(await edenToken.balanceOf(payments.address)).to.eq(0)
        })

        it("payer can stop a payment in the future", async function() {
            const balanceBefore = await edenToken.balanceOf(deployer.address)
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            let alicePayments = await payments.allPayments(alice.address)
            let payment = alicePayments[0]
            expect(payment[0]).to.eq(edenToken.address)
            expect(payment[1]).to.eq(alice.address)
            expect(payment[2]).to.eq(deployer.address)
            expect(payment[3]).to.eq(START_TIME)
            expect(payment[4]).to.eq(0)
            expect(payment[5]).to.eq(0)
            expect(payment[6]).to.eq(DURATION_IN_SECS)
            expect(payment[7]).to.eq(paymentAmount)
            expect(payment[8]).to.eq(0)
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore.sub(paymentAmount))
            await payments.stopPayment(0, START_TIME + 100000)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + 99999])
            await ethers.provider.send("evm_mine")            
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.not.be.empty
            expect(await edenToken.balanceOf(deployer.address)).to.be.lt(balanceBefore)
            expect(await edenToken.balanceOf(deployer.address)).to.be.gt(balanceBefore.sub(paymentAmount))
            let paymentBalance = await payments.paymentBalance(0)
            payment = paymentBalance[2]
            expect(payment[4]).to.eq(START_TIME + 100000)
            await payments.connect(alice).claimAllAvailableTokens([0])
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            expect(await edenToken.balanceOf(alice.address)).to.be.gt(0)
            expect(await edenToken.balanceOf(payments.address)).to.eq(0)
        })

        it("receiver can stop a payment in the future", async function() {
            const balanceBefore = await edenToken.balanceOf(deployer.address)
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            let alicePayments = await payments.allPayments(alice.address)
            let payment = alicePayments[0]
            expect(payment[0]).to.eq(edenToken.address)
            expect(payment[1]).to.eq(alice.address)
            expect(payment[2]).to.eq(deployer.address)
            expect(payment[3]).to.eq(START_TIME)
            expect(payment[4]).to.eq(0)
            expect(payment[5]).to.eq(0)
            expect(payment[6]).to.eq(DURATION_IN_SECS)
            expect(payment[7]).to.eq(paymentAmount)
            expect(payment[8]).to.eq(0)
            expect(await edenToken.balanceOf(deployer.address)).to.eq(balanceBefore.sub(paymentAmount))
            await payments.connect(alice).stopPayment(0, START_TIME + 100000)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + 99999])
            await ethers.provider.send("evm_mine")            
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.not.be.empty
            expect(await edenToken.balanceOf(deployer.address)).to.be.lt(balanceBefore)
            expect(await edenToken.balanceOf(deployer.address)).to.be.gt(balanceBefore.sub(paymentAmount))
            let paymentBalance = await payments.paymentBalance(0)
            payment = paymentBalance[2]
            expect(payment[4]).to.eq(START_TIME + 100000)
            await payments.connect(alice).claimAllAvailableTokens([0])
            activePayments = await payments.activePayments(alice.address)
            expect(activePayments).to.be.empty
            expect(await edenToken.balanceOf(alice.address)).to.be.gt(0)
            expect(await edenToken.balanceOf(payments.address)).to.eq(0)
        })

        it("no one else can stop a payment", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            await expect(payments.connect(bob).stopPayment(0, 0)).to.be.revertedWith("Payments::stopPayment: msg.sender must be payer or receiver")
        })

        it("cannot stop a payment twice", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            await payments.stopPayment(0, 0)
            await expect(payments.stopPayment(0, 0)).to.be.revertedWith("Payments::stopPayment: payment already stopped")
        })

        it("cannot stop a payment after end time", async function() {
            await edenToken.approve(payments.address, ethers.constants.MaxUint256)
            let decimals = await edenToken.decimals()
            const { timestamp } = await ethers.provider.getBlock('latest')
            const START_TIME = timestamp + 21600
            const DURATION_IN_DAYS = 4
            const DURATION_IN_SECS = DURATION_IN_DAYS * 24 * 60 * 60
            let paymentAmount = ethers.BigNumber.from(1000).mul(ethers.BigNumber.from(10).pow(decimals))
            await payments.createPayment(edenToken.address, deployer.address, alice.address, START_TIME, paymentAmount, DURATION_IN_SECS, 0)
            let alicePayments = await payments.allPayments(alice.address)
            let payment = alicePayments[0]
            expect(payment[0]).to.eq(edenToken.address)
            expect(payment[1]).to.eq(alice.address)
            expect(payment[2]).to.eq(deployer.address)
            expect(payment[3]).to.eq(START_TIME)
            expect(payment[4]).to.eq(0)
            expect(payment[6]).to.eq(DURATION_IN_SECS)
            expect(payment[7]).to.eq(paymentAmount)
            expect(payment[8]).to.eq(0)
            await ethers.provider.send("evm_setNextBlockTimestamp", [START_TIME + DURATION_IN_SECS])
            await expect(payments.stopPayment(0, 0)).to.be.revertedWith("Payments::stopPayment: stop time > payment duration")
        })
    })
})
