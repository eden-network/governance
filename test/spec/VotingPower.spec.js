const { expect } = require("chai");
const fs = require('fs')
const { ethers, getChainId } = require("hardhat");
const { governanceFixture } = require("../fixtures")
const { ecsign } = require("ethereumjs-util")

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY

const DOMAIN_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
)

const PERMIT_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

describe("VotingPower", function() {
    let edenToken
    let votingPower
    let votingPowerPrism
    let votingPowerImplementation
    let deployer
    let admin
    let alice
    let bob
    let ZERO_ADDRESS
    let chainId

    beforeEach(async () => {
        const fix = await governanceFixture()
        edenToken = fix.edenToken
        votingPower = fix.votingPower
        votingPowerPrism = fix.votingPowerPrism
        votingPowerImplementation = fix.votingPowerImplementation
        deployer = fix.deployer
        admin = fix.admin
        alice = fix.alice
        bob = fix.bob
        ZERO_ADDRESS = fix.ZERO_ADDRESS
        chainId = await getChainId()
    })

    context("Pre-Init", async () => {
        context("edenToken", async () => {
            it("reverts", async function() {
                await expect(votingPower.edenToken()).to.reverted
            })
        })
    })
    context("Post-Init", async () => {
        beforeEach(async () => {
            await votingPowerPrism.setPendingProxyImplementation(votingPowerImplementation.address)
            await votingPowerImplementation.become(votingPowerPrism.address)
            await votingPower.initialize(edenToken.address, admin.address)
        })
        context("edenToken", async () => {
            it("returns the current EDEN token address", async function() {
                expect(await votingPower.edenToken()).to.eq(edenToken.address)
                expect(await votingPowerImplementation.edenToken()).to.eq(ZERO_ADDRESS)
            })
        })

        context("decimals", async () => {
            it("returns the correct decimals for voting power", async function() {
                expect(await votingPower.decimals()).to.eq(18)
            })
        })

        context("stake", async () => {
            it("allows a valid stake", async function() {
                const userBalanceBefore = await edenToken.balanceOf(deployer.address)
                const contractBalanceBefore = await edenToken.balanceOf(votingPower.address)
                const totalEdenStakedBefore = await votingPower.getEDENAmountStaked(deployer.address)
                const userVotesBefore = await votingPower.balanceOf(deployer.address)
                await edenToken.approve(votingPower.address, 1000)
                await votingPower['stake(uint256)'](1000)
                expect(await edenToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(1000))
                expect(await edenToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(1000))
                expect(await votingPower.getEDENAmountStaked(deployer.address)).to.eq(totalEdenStakedBefore.add(1000))
                expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.add(1000))
            })

            it("does not allow a zero stake amount", async function() {
                await expect(votingPower['stake(uint256)'](0)).to.revertedWith("VP::stake: cannot stake 0")
            })

            it("does not allow a user to stake more tokens than they have", async function() {
                await expect(votingPower.connect(alice)['stake(uint256)'](1000)).to.revertedWith("VP::stake: not enough tokens")
            })

            it("does not allow a user to stake before approval", async function() {
                await expect(votingPower['stake(uint256)'](1000)).to.revertedWith("VP::stake: must approve tokens before staking")
            })

        })

        context("stakeWithPermit", async () => {
            it("allows a valid stake with permit", async function() {
                const value = 1000
                const userBalanceBefore = await edenToken.balanceOf(deployer.address)
                const contractBalanceBefore = await edenToken.balanceOf(votingPower.address)
                const totalEdenStakedBefore = await votingPower.getEDENAmountStaked(deployer.address)
                const userVotesBefore = await votingPower.balanceOf(deployer.address)
                
                const domainSeparator = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
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
                            [PERMIT_TYPEHASH, deployer.address, votingPower.address, value, nonce, deadline]
                            )
                        ),
                        ]
                    )
                )
        
                const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
                await votingPower.stakeWithPermit(value, deadline, v, r, s)
                expect(await edenToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(value))
                expect(await edenToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(value))
                expect(await votingPower.getEDENAmountStaked(deployer.address)).to.eq(totalEdenStakedBefore.add(value))
                expect(await votingPower.balanceOf(deployer.address)).to.eq(userVotesBefore.add(value))
            })

            it("does not allow a zero stake amount", async function() {
                const value = 0
                const domainSeparator = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
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
                            [PERMIT_TYPEHASH, deployer.address, votingPower.address, value, nonce, deadline]
                            )
                        ),
                        ]
                    )
                )
        
                const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
                await expect(votingPower.stakeWithPermit(value, deadline, v, r, s)).to.revertedWith("VP::stakeWithPermit: cannot stake 0")
            })

            it("does not allow a user to stake using a permit signed by someone else", async function() {
                const value = 1000
                const domainSeparator = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
                    )
                )
          
                  
                const nonce = await edenToken.nonces(alice.address)
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
                            [PERMIT_TYPEHASH, alice.address, votingPower.address, value, nonce, deadline]
                            )
                        ),
                        ]
                    )
                )
        
                const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
                await expect(votingPower.stakeWithPermit(value, deadline, v, r, s)).to.revertedWith("revert Eden::validateSig: invalid signature")
            })

            it("does not allow a user to stake more tokens than they have", async function() {
                const value = 1000
                const domainSeparator = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                        [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
                    )
                )
          
                  
                const nonce = await edenToken.nonces(alice.address)
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
                            [PERMIT_TYPEHASH, alice.address, votingPower.address, value, nonce, deadline]
                            )
                        ),
                        ]
                    )
                )
        
                const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
                await expect(votingPower.connect(alice).stakeWithPermit(value, deadline, v, r, s)).to.revertedWith("VP::stakeWithPermit: not enough tokens")
            })
        })

        context("withdraw", async () => {
            it("allows a valid withdrawal", async function() {
                const userBalanceBefore = await edenToken.balanceOf(deployer.address)
                const contractBalanceBefore = await edenToken.balanceOf(votingPower.address)
                const totalEdenStakedBefore = await votingPower.getEDENAmountStaked(deployer.address)
                const userVotesBefore = await votingPower.balanceOf(deployer.address)
                await edenToken.approve(votingPower.address, 1000)
                await votingPower['stake(uint256)'](1000)
                expect(await edenToken.balanceOf(deployer.address)).to.eq(userBalanceBefore.sub(1000))
                expect(await edenToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore.add(1000))
                expect(await votingPower.getEDENAmountStaked(deployer.address)).to.eq(totalEdenStakedBefore.add(1000))
                const userVotesAfter = await votingPower.balanceOf(deployer.address)
                expect(userVotesAfter).to.eq(userVotesBefore.add(1000))
                await votingPower['withdraw(uint256)'](1000)
                expect(await edenToken.balanceOf(deployer.address)).to.eq(userBalanceBefore)
                expect(await edenToken.balanceOf(votingPower.address)).to.eq(contractBalanceBefore)
                expect(await votingPower.getEDENAmountStaked(deployer.address)).to.eq(totalEdenStakedBefore)
                expect(await votingPower.balanceOf(deployer.address)).to.eq(0)
            })

            it("does not allow a zero withdrawal amount", async function() {
                await expect(votingPower['withdraw(uint256)'](0)).to.revertedWith("VP::withdraw: cannot withdraw 0")
            })

            it("does not allow a user to withdraw more than their current stake", async function() {
                await edenToken.approve(votingPower.address, 1000)
                await votingPower['stake(uint256)'](1000)
                await expect(votingPower['withdraw(uint256)'](1001)).to.revertedWith("VP::_withdraw: not enough tokens staked")
            })
        })
    })
})
