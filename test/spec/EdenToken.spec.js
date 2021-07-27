const { expect } = require("chai")
const { ethers, getChainId } = require("hardhat");
const { tokenFixture } = require("../fixtures")
const { ecsign } = require("ethereumjs-util")

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY

const DOMAIN_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
)

const PERMIT_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

const TRANSFER_WITH_AUTHORIZATION_TYPEHASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)')
)

const RECEIVE_WITH_AUTHORIZATION_TYPEHASH = ethers.utils.keccak256(
  ethers.utils.toUtf8Bytes('ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)')
)

describe('EdenToken', () => {
    let edenToken
    let deployer
    let admin
    let alice
    let bob
    let ZERO_ADDRESS
    let chainId

    beforeEach(async () => {
      const fix = await tokenFixture()
      edenToken = fix.edenToken
      deployer = fix.deployer
      admin = fix.admin
      alice = fix.alice
      bob = fix.bob
      ZERO_ADDRESS = fix.ZERO_ADDRESS
      chainId = await getChainId()
    })

    context('transfer', async () => {
      it('allows a valid transfer', async () => {
        const amount = 100
        const balanceBefore = await edenToken.balanceOf(alice.address)
        await edenToken.transfer(alice.address, amount)
        expect(await edenToken.balanceOf(alice.address)).to.eq(balanceBefore.add(amount))
      })

      it('does not allow a transfer to the zero address', async () => {
        const amount = 100
        await expect(edenToken.transfer(ZERO_ADDRESS, amount)).to.revertedWith("Eden::_transferTokens: cannot transfer to the zero address")
      })
    })

    context('transferFrom', async () => {
      it('allows a valid transferFrom', async () => {
        const amount = 100
        const senderBalanceBefore = await edenToken.balanceOf(deployer.address)
        const receiverBalanceBefore = await edenToken.balanceOf(bob.address)
        await edenToken.approve(alice.address, amount)
        expect(await edenToken.allowance(deployer.address, alice.address)).to.eq(amount)
        await edenToken.connect(alice).transferFrom(deployer.address, bob.address, amount)
        expect(await edenToken.balanceOf(deployer.address)).to.eq(senderBalanceBefore.sub(amount))
        expect(await edenToken.balanceOf(bob.address)).to.eq(receiverBalanceBefore.add(amount))
        expect(await edenToken.allowance(deployer.address, alice.address)).to.eq(0)
      })

      it('allows for infinite approvals', async () => {
        const amount = 100
        const maxAmount = ethers.constants.MaxUint256
        await edenToken.approve(alice.address, maxAmount)
        expect(await edenToken.allowance(deployer.address, alice.address)).to.eq(maxAmount)
        await edenToken.connect(alice).transferFrom(deployer.address, bob.address, amount)
        expect(await edenToken.allowance(deployer.address, alice.address)).to.eq(maxAmount)
      })

      it('cannot transfer in excess of the spender allowance', async () => {
        await edenToken.transfer(alice.address, 100)
        const balance = await edenToken.balanceOf(alice.address)
        await expect(edenToken.transferFrom(alice.address, bob.address, balance)).to.be.reverted
      })
    })
  
    context('transferWithAuthorization', async () => {
      it('allows a valid transfer with auth', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const validAfter = 0
        const validBefore = ethers.constants.MaxUint256
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [TRANSFER_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        const balanceBefore = await edenToken.balanceOf(alice.address)
        await edenToken.transferWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))
        expect(await edenToken.balanceOf(alice.address)).to.eq(balanceBefore.add(value))
      })

      it('does not allow a transfer before auth valid', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const { timestamp } = await ethers.provider.getBlock('latest')
        const validAfter = timestamp + 1000
        const validBefore = ethers.constants.MaxUint256
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [TRANSFER_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await expect(edenToken.transferWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))).to.revertedWith("Eden::transferWithAuth: auth not yet valid")
      })

      it('does not allow a transfer after auth expiration', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const validAfter = 0
        const validBefore = 0
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [TRANSFER_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await expect(edenToken.transferWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))).to.revertedWith("Eden::transferWithAuth: auth expired")
      })

      it('does not allow a reuse of nonce', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const validAfter = 0
        const validBefore = ethers.constants.MaxUint256
        let digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [TRANSFER_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        let { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        const balanceBefore = await edenToken.balanceOf(alice.address)
        await edenToken.transferWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))
        expect(await edenToken.balanceOf(alice.address)).to.eq(balanceBefore.add(value))

        digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [TRANSFER_WITH_AUTHORIZATION_TYPEHASH, deployer.address, bob.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        let sig = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))

        await expect(edenToken.transferWithAuthorization(deployer.address, bob.address, value, validAfter, validBefore, nonce, sig.v, ethers.utils.hexlify(sig.r), ethers.utils.hexlify(sig.s))).to.revertedWith("Eden::transferWithAuth: auth already used")
      })
    })

    context('receiveWithAuthorization', async () => {
      it('allows a valid receive with auth', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const validAfter = 0
        const validBefore = ethers.constants.MaxUint256
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [RECEIVE_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        const balanceBefore = await edenToken.balanceOf(alice.address)
        await edenToken.connect(alice).receiveWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))
        expect(await edenToken.balanceOf(alice.address)).to.eq(balanceBefore.add(value))
      })

      it('does not allow a user to initiate a transfer intended for another user', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const validAfter = 0
        const validBefore = ethers.constants.MaxUint256
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [RECEIVE_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await expect(edenToken.connect(bob).receiveWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))).to.revertedWith("Eden::receiveWithAuth: caller must be the payee")
      })

      it('does not allow a receive before auth valid', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const { timestamp } = await ethers.provider.getBlock('latest')
        const validAfter = timestamp + 1000
        const validBefore = ethers.constants.MaxUint256
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [RECEIVE_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await expect(edenToken.connect(alice).receiveWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))).to.revertedWith("Eden::receiveWithAuth: auth not yet valid")
      })

      it('does not allow a receive after auth expiration', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const validAfter = 0
        const validBefore = 0
        const digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [RECEIVE_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await expect(edenToken.connect(alice).receiveWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))).to.revertedWith("Eden::receiveWithAuth: auth expired")
      })

      it('does not allow a reuse of nonce', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )
    
        const value = 345
        const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32))
        const validAfter = 0
        const validBefore = ethers.constants.MaxUint256
        let digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [RECEIVE_WITH_AUTHORIZATION_TYPEHASH, deployer.address, alice.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        let { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        const balanceBefore = await edenToken.balanceOf(alice.address)
        await edenToken.connect(alice).receiveWithAuthorization(deployer.address, alice.address, value, validAfter, validBefore, nonce, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))
        expect(await edenToken.balanceOf(alice.address)).to.eq(balanceBefore.add(value))

        digest = ethers.utils.keccak256(
          ethers.utils.solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
              '0x19',
              '0x01',
              domainSeparator,
              ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                  ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                  [RECEIVE_WITH_AUTHORIZATION_TYPEHASH, deployer.address, bob.address, value, validAfter, validBefore, nonce]
                )
              ),
            ]
          )
        )
    
        let sig = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))

        await expect(edenToken.connect(bob).receiveWithAuthorization(deployer.address, bob.address, value, validAfter, validBefore, nonce, sig.v, ethers.utils.hexlify(sig.r), ethers.utils.hexlify(sig.s))).to.revertedWith("Eden::receiveWithAuth: auth already used")
      })
    })
    
    context('permit', async () => {
      it('allows a valid permit', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )

        const value = 123
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
                  [PERMIT_TYPEHASH, deployer.address, alice.address, value, nonce, deadline]
                )
              ),
            ]
          )
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await edenToken.permit(deployer.address, alice.address, value, deadline, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))
        expect(await edenToken.allowance(deployer.address, alice.address)).to.eq(value)
        expect(await edenToken.nonces(deployer.address)).to.eq(1)

        await edenToken.connect(alice).transferFrom(deployer.address, bob.address, value)
      })

      it('does not allow a permit after deadline', async () => {
        const domainSeparator = ethers.utils.keccak256(
          ethers.utils.defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [DOMAIN_TYPEHASH, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(await edenToken.name())), ethers.utils.keccak256(ethers.utils.toUtf8Bytes("1")), chainId, edenToken.address]
          )
        )

        const value = 123
        const nonce = await edenToken.nonces(deployer.address)
        const deadline = 0
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
                  [PERMIT_TYPEHASH, deployer.address, alice.address, value, nonce, deadline]
                )
              ),
            ]
          )
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(DEPLOYER_PRIVATE_KEY, 'hex'))
        
        await expect(edenToken.permit(deployer.address, alice.address, value, deadline, v, ethers.utils.hexlify(r), ethers.utils.hexlify(s))).to.revertedWith("Eden::permit: signature expired")
      })
    })

    context("mint", async () => {
      it('can perform a valid mint', async () => {
        const totalSupplyBefore = await edenToken.totalSupply()
        const maxSupply = await edenToken.maxSupply()
        const maxAmount = maxSupply.sub(totalSupplyBefore)
        const balanceBefore = await edenToken.balanceOf(alice.address)
        await edenToken.mint(alice.address, maxAmount)
        expect(await edenToken.balanceOf(alice.address)).to.equal(balanceBefore.add(maxAmount))
        expect(await edenToken.totalSupply()).to.equal(totalSupplyBefore.add(maxAmount))
      })

      it('cannot mint to the zero address', async () => {
        await expect(edenToken.mint(ZERO_ADDRESS, 1)).to.revertedWith("Eden::mint: cannot transfer to the zero address")
      })

      it('cannot mint in excess of maxSupply', async () => {
        const totalSupply = await edenToken.totalSupply()
        const maxSupply = await edenToken.maxSupply()
        const maxAmount = maxSupply.sub(totalSupply)
        await expect(edenToken.mint(alice.address, maxAmount.add(1))).to.revertedWith("Eden::mint: exceeds max supply")
      })
    })
  
    context("burn", async () => {
      it('can perform a valid burn', async () => {
        const amount = 100
        const totalSupplyBefore = await edenToken.totalSupply()
        const balanceBefore = await edenToken.balanceOf(deployer.address)
        await edenToken.burn(amount)
        expect(await edenToken.balanceOf(deployer.address)).to.equal(balanceBefore.sub(amount))
        expect(await edenToken.totalSupply()).to.equal(totalSupplyBefore.sub(amount))
      })
    })

    context("setMetadataManager", async () => {
      it('can set a new valid metadata manager', async () => {
        await edenToken.connect(admin).setMetadataManager(bob.address)
        expect(await edenToken.metadataManager()).to.equal(bob.address)
      })

      it('only metadata manager can set a new metadata manager', async () => {
        await expect(edenToken.connect(alice).setMetadataManager(bob.address)).to.revertedWith("Eden::setMetadataManager: only MM can change MM")
      })
    })

    context("updateTokenMetadata", async () => {
      it('metadata manager can update token metadata', async () => {
        await edenToken.connect(admin).updateTokenMetadata("New Token", "NEW")
        expect(await edenToken.name()).to.equal("New Token")
        expect(await edenToken.symbol()).to.equal("NEW")
      })

      it('only metadata manager can update token metadata', async () => {
        await expect(edenToken.connect(alice).updateTokenMetadata("New Token", "NEW")).to.revertedWith("Eden::updateTokenMeta: only MM can update token metadata")
      })
    })
  })