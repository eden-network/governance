const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { distributorFixture } = require("../fixtures");
const BalanceTree = require("../../scripts/utils/balanceTree");

const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
const UPDATER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPDATER_ROLE"));
const SLASHER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SLASHER_ROLE"));
const DISTRIBUTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DISTRIBUTOR_ROLE"));

function makeBalances(accounts) {
    return accounts.map((account, index) => { return {
        account: account.address,
        signer: account,
        amount: ethers.utils.parseUnits((1337 / Math.pow(10, index)).toFixed(18))
    }});
}

describe("MerkleDistributor", () => {
    let fix;

    beforeEach(async () => {
        fix = await distributorFixture();
    });

    context("constructor", () => {
        it("initial state", async () => {
            expect(await fix.merkleDistributor.hasRole(DEFAULT_ADMIN_ROLE, fix.admin.address)).true;
            expect(await fix.merkleDistributor.hasRole(UPDATER_ROLE, fix.admin.address)).true;
            expect(await fix.merkleDistributor.hasRole(SLASHER_ROLE, fix.admin.address)).false;
            expect(await fix.merkleDistributor.hasRole(DISTRIBUTOR_ROLE, fix.admin.address)).false;

            expect(await fix.merkleDistributor.distributionCount()).equal(0);
            expect(await fix.merkleDistributor.merkleRoot()).equal(ethers.constants.HashZero);
        });
    });

    context("updateMerkleRoot", () => {
        it("updater can call", async () => {
            await expect(fix.merkleDistributor.updateMerkleRoot(
                ethers.utils.id(ethers.utils.id(ethers.constants.HashZero)), `${ethers.constants.HashZero}.json`, 1)).not.reverted;
        });

        it("non-updater cannot call", async () => {
            await expect(fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(
                ethers.constants.HashZero, `${ethers.constants.HashZero}.json`, 1))
                .revertedWith("MerkleDistributor: Caller must have UPDATER_ROLE");
        });

        it("new roots take effect and NFTs are minted while old NFT is still valid", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributor.setUpdateThreshold(2);

            const epoch = (await fix.merkleDistributor.distributionCount()).toNumber();

            const root = ethers.utils.id("I've never been to Mars, but I imagine it's quite nice.");
            await fix.merkleDistributor.updateMerkleRoot(root, `${root}.json`, 1);
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root, `${root}.json`, 1);
            expect(await fix.merkleDistributor.merkleRoot()).equal(root);
            expect(await fix.merkleDistributor.tokenURI(epoch + 1)).equal(`${root}.json`);
            expect(await fix.merkleDistributor.ownerOf(epoch + 1)).equal(fix.accounts[1].address);

            const root2 = ethers.utils.id("You know how to take the reservation, you just don't know how to hold the reservation.");
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root2, `${root2}.json`, 2);
            await fix.merkleDistributor.updateMerkleRoot(root2, `${root2}.json`, 2);
            expect(await fix.merkleDistributor.merkleRoot()).equal(root2);
            expect(await fix.merkleDistributor.tokenURI(epoch + 2)).equal(`${root2}.json`);
            expect(await fix.merkleDistributor.ownerOf(epoch + 2)).equal(fix.admin.address);

            expect(await fix.merkleDistributor.tokenURI(epoch + 1)).equal(`${root}.json`);
            expect(await fix.merkleDistributor.ownerOf(epoch + 1)).equal(fix.accounts[1].address);
        });

        it("cannot apply a previous root", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributor.setUpdateThreshold(2);

            const root = ethers.utils.id("The sea was angry that day, my friends.");
            await fix.merkleDistributor.updateMerkleRoot(root, `${root}.json`, 1);
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root, `${root}.json`, 1);
            expect(await fix.merkleDistributor.previousMerkleRoot(root)).true;

            const root2 = ethers.utils.id("Like an old man trying to send back soup in a deli.");
            await fix.merkleDistributor.updateMerkleRoot(root2, `${root2}.json`, 2);
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root2, `${root2}.json`, 2);
            expect(await fix.merkleDistributor.previousMerkleRoot(root)).true;
            expect(await fix.merkleDistributor.previousMerkleRoot(root2)).true;

            const root3 = ethers.utils.id("I got about fifty feet out")
            expect(await fix.merkleDistributor.previousMerkleRoot(root3)).false;
            await expect(fix.merkleDistributor.updateMerkleRoot(root, `${root}.json`, 3));
            await expect(fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root, `${root}.json`, 3))
                .revertedWith("MerkleDistributor: Cannot update to a previous merkle root");
        });

        it("can only update for next distribution", async () => {
            const root = ethers.utils.id("Suddenly, the great beast appeared before me!");
            await expect(fix.merkleDistributor.updateMerkleRoot(root, `${root}.json`, 2))
                .revertedWith("MerkleDistributor: Can only update next distribution");
        });

        it("same updater cannot update twice for same distribution", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributor.setUpdateThreshold(2);

            const root = ethers.utils.id("I tell you, he was ten stories high if he was a foot.");
            await fix.merkleDistributor.updateMerkleRoot(root, `${root}.json`, 1);
            await expect(fix.merkleDistributor.updateMerkleRoot(root, `${root}.json`, 1))
                .revertedWith("MerkleDistributor: Updater already submitted new root");
            expect(await fix.merkleDistributor.merkleRoot()).equal(ethers.constants.HashZero);
        })

        it("disagreement", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[2].address);
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[3].address);
            await fix.merkleDistributor.setUpdateThreshold(2);

            const root = ethers.utils.id("As if sensing my presence, he let out a great bellow.");
            await expect(fix.merkleDistributor.updateMerkleRoot(root, `${root}.json`, 1))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(ethers.constants.HashZero);

            const root2 = ethers.utils.id("I said, \"Easy, big fella!\"");
            await expect(fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root2, `${root2}.json`, 1))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(ethers.constants.HashZero);

            await expect(fix.merkleDistributor.connect(fix.accounts[2]).updateMerkleRoot(root, `${root}.json`, 1))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(root);

            await expect(fix.merkleDistributor.connect(fix.accounts[3]).updateMerkleRoot(root2, `${root2}.json`, 1))
                .revertedWith("MerkleDistributor: Can only update next distribution");
            expect(await fix.merkleDistributor.merkleRoot()).equal(root);

            const root3 = ethers.utils.id("I realized that something was obstructing its breathing.");
            await expect(fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root3, `${root3}.json`, 2))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(root);

            await expect(fix.merkleDistributor.connect(fix.accounts[3]).updateMerkleRoot(root, `${root}.json`, 2))
                .revertedWith("MerkleDistributor: Cannot update to a previous merkle root");

            await expect(fix.merkleDistributor.connect(fix.accounts[3]).updateMerkleRoot(root3, `${root3}.json`, 2))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(root3);
        });

        it("changed threshold takes effect", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[2].address);
            await fix.merkleDistributor.setUpdateThreshold(2);

            const root = ethers.utils.id("I could see directly into the eye of the great fish.");
            await expect(fix.merkleDistributor.updateMerkleRoot(root, `${root}.json`, 1))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(ethers.constants.HashZero);
            await expect(fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root, `${root}.json`, 1))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(root);

            await fix.merkleDistributor.setUpdateThreshold(3);

            const root2 = ethers.utils.id("Mammal.");
            await expect(fix.merkleDistributor.updateMerkleRoot(root2, `${root2}.json`, 2))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(root);
            await expect(fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(root2, `${root2}.json`, 2))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(root);
            await expect(fix.merkleDistributor.connect(fix.accounts[2]).updateMerkleRoot(root2, `${root2}.json`, 2))
                .not.reverted;
            expect(await fix.merkleDistributor.merkleRoot()).equal(root2);
        });
    });

    context("claim", () => {
        it("rewards claimable", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributor.setUpdateThreshold(2);
            
            // first, check that rewards are claimable from the initial empty state
            const balances = makeBalances(fix.accounts.slice(2));
            const tree = new BalanceTree(balances);

            const totalRewards = balances.reduce((accumulator, currentValue) => {
                return accumulator.add(currentValue.amount);
            }, BigNumber.from(0));

            // update the root
            await fix.merkleDistributor.updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1);
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1);

            // check that a failed mint reverts
            let proof = tree.getProof(0, balances[0].account, balances[0].amount);
            await expect(fix.merkleDistributor.connect(balances[0].signer)
                .claim(0, balances[0].account, balances[0].amount, proof))
                .reverted;

            // turn on minting
            await fix.edenToken.grantRole(
                '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6',
                fix.merkleDistributor.address
            );

            // check that we cannot claim to someone else without DISTRIBUTOR_ROLE
            proof = tree.getProof(0, balances[0].account, balances[0].amount);
            await expect(fix.merkleDistributor
                .claim(0, balances[0].account, balances[0].amount, proof))
                .revertedWith("MerkleDistributor: Cannot collect rewards");

            await fix.merkleDistributor.grantRole(DISTRIBUTOR_ROLE, fix.admin.address);

            for (const [index, balance] of balances.entries()) {
                const proof = tree.getProof(index, balance.account, balance.amount);

                // claim and verify tokens were transfered
                const beforeBalance = await fix.edenToken.balanceOf(balance.account);
                const caller = index == 0 ? fix.admin : balance.signer; // for first balance, check distributor can call
                await expect(fix.merkleDistributor.connect(caller)
                    .claim(index, balance.account, balance.amount, proof))
                    .not.reverted;
                const afterBalance = await fix.edenToken.balanceOf(balance.account);
                expect(afterBalance.sub(beforeBalance)).eq(balance.amount);

                // verify they cannot be claimed again
                await expect(fix.merkleDistributor.connect(balance.signer)
                    .claim(index, balance.account, balance.amount, proof))
                    .revertedWith("MerkleDistributor: Nothing claimable");
            }

            // all tokens should have been distributed
            expect(await fix.edenToken.balanceOf(fix.merkleDistributor.address)).eq(BigNumber.from(0));

            // now, set a new root with all balances increased by 1, except for the last
            // account, which will get no new balance. should only be able to claim the increase
            const newBalances = balances.slice(0, balances.length - 1).map(x => { return {
                ...x,
                amount: x.amount.add(1)
            }});
            const newTree = new BalanceTree(newBalances);

            // apply the new root
            await fix.merkleDistributor.updateMerkleRoot(newTree.getHexRoot(), `${newTree.getHexRoot()}.json`, 2);
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(newTree.getHexRoot(), `${newTree.getHexRoot()}.json`, 2);

            // assign a reward collector for the first three balances
            for (const i of [0, 1, 2]) {
                await expect(fix.distributorGovernance.delegate(newBalances[i].signer.address, fix.accounts[1].address))
                    .not.reverted;
            }

            // test that a collector receives the rewards when calling
            proof = newTree.getProof(0, newBalances[0].account, newBalances[0].amount);
            await expect(fix.merkleDistributor.connect(fix.accounts[1])
                    .claim(0, newBalances[0].account, newBalances[0].amount, proof))
                    .not.reverted;
            expect(await fix.edenToken.balanceOf(fix.accounts[1].address)).eq(BigNumber.from(1));

            // test that a distributor distributes to the collector
            proof = newTree.getProof(1, newBalances[1].account, newBalances[1].amount);
            await expect(fix.merkleDistributor.connect(fix.admin)
                    .claim(1, newBalances[1].account, newBalances[1].amount, proof))
                    .not.reverted;
            expect(await fix.edenToken.balanceOf(fix.accounts[1].address)).eq(BigNumber.from(2));

            // the first index that is claimed in this loop has a collector assigned, but calling
            // from the actual account should transfer the balances there
            for (const [index, balance] of newBalances.slice(2).entries()) {
                const proof = newTree.getProof(index + 2, balance.account, balance.amount);

                // claim and verify tokens were transfered
                const beforeBalance = await fix.edenToken.balanceOf(balance.account);
                await expect(fix.merkleDistributor.connect(balance.signer)
                    .claim(index + 2, balance.account, balance.amount, proof))
                    .not.reverted;
                const afterBalance = await fix.edenToken.balanceOf(balance.account);
                expect(afterBalance.sub(beforeBalance).eq(BigNumber.from(1)));

                // verify they cannot be claimed again
                await expect(fix.merkleDistributor.connect(balance.signer)
                    .claim(index + 2, balance.account, balance.amount, proof))
                    .revertedWith("MerkleDistributor: Nothing claimable");
            }

            // check that old valid claims do not work
            const lastBalance = balances[balances.length - 1];
            const lastProof = tree.getProof(balances.length - 1, lastBalance.account, lastBalance.amount);
            await expect(fix.merkleDistributor.connect(lastBalance.signer)
                    .claim(balances.length - 1, lastBalance.account, lastBalance.amount, lastProof))
                    .revertedWith("MerkleDistributor: Invalid proof");
        });
    });

    context("setGovernance", () => {
        it("admin can call and change takes effect", async () => {
            expect(await fix.merkleDistributor.governance()).not.equal(ethers.constants.AddressZero);
            await fix.merkleDistributor.setGovernance(ethers.constants.AddressZero);
            expect(await fix.merkleDistributor.governance()).equal(ethers.constants.AddressZero);
        });

        it("non-admin cannot call", async () => {
            await expect(fix.merkleDistributor.connect(fix.accounts[1]).setGovernance(ethers.constants.AddressZero))
                .revertedWith("MerkleDistributor: Caller must have DEFAULT_ADMIN_ROLE");
        })
    })

    context("setUpdateThreshold", () => {
        it("admin can call and change takes effect", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            expect(await fix.merkleDistributor.updateThreshold()).equal(1);
            await fix.merkleDistributor.setUpdateThreshold(2);
            expect(await fix.merkleDistributor.updateThreshold()).equal(2);
        });

        it("non-admin cannot call", async () => {
            await expect(fix.merkleDistributor.connect(fix.accounts[1]).setUpdateThreshold(2))
                .revertedWith("MerkleDistributor: Caller must have DEFAULT_ADMIN_ROLE");
        });

        it("cannot set a zero threshold", async () => {
            await expect(fix.merkleDistributor.setUpdateThreshold(0))
                .revertedWith("MerkleDistributor: Update threshold must be non-zero");
        });

        it("cannot set a threshold greater than accounts with UPDATER_ROLE", async () => {
            await expect(fix.merkleDistributor.setUpdateThreshold(2))
                .revertedWith("MerkleDistributor: threshold > updaters");
        })
    })

    context("erc721", () => {
        it("initial state", async () => {
            expect(await fix.merkleDistributor.totalSupply()).to.equal(0);

            for (const i of [0, 1]) {
                await expect(fix.merkleDistributor.ownerOf(i)).revertedWith("ERC721: owner query for nonexistent token");
                await expect(fix.merkleDistributor.tokenURI(i)).revertedWith("ERC721URIStorage: URI query for nonexistent toke");
                await expect(fix.merkleDistributor.tokenByIndex(i)).revertedWith("ERC721Enumerable: global index out of bounds");
                await expect(fix.merkleDistributor.tokenOfOwnerByIndex(
                    fix.merkleDistributor.address, i)).revertedWith("ERC721Enumerable: owner index out of bounds");
            }
        });

        it("properties", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributor.setUpdateThreshold(2);

            const balances = makeBalances([fix.admin]);
            const tree = new BalanceTree(balances);
            await fix.merkleDistributor.updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1);
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1);

            expect(await fix.merkleDistributor.totalSupply()).to.equal(1);
            expect(await fix.merkleDistributor.ownerOf(1)).to.equal(fix.accounts[1].address);
            expect(await fix.merkleDistributor.tokenByIndex(0)).to.equal(1);
            expect(await fix.merkleDistributor.tokenOfOwnerByIndex(fix.accounts[1].address, 0)).to.equal(1);
            expect(await fix.merkleDistributor.tokenURI(1)).to.equal(`${tree.getHexRoot()}.json`);

            await fix.merkleDistributor.updateMerkleRoot(ethers.utils.id(tree.getHexRoot()), `${tree.getHexRoot()}.json`, 2);
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(ethers.utils.id(tree.getHexRoot()), `${tree.getHexRoot()}.json`, 2);

            expect(await fix.merkleDistributor.totalSupply()).to.equal(2);
            expect(await fix.merkleDistributor.ownerOf(2)).to.equal(fix.accounts[1].address);
            expect(await fix.merkleDistributor.tokenByIndex(1)).to.equal(2);
            expect(await fix.merkleDistributor.tokenOfOwnerByIndex(fix.accounts[1].address, 1)).to.equal(2);
            expect(await fix.merkleDistributor.tokenURI(2)).to.equal(`${tree.getHexRoot()}.json`);
        });

        it("transfer", async () => {
            await fix.merkleDistributor.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributor.setUpdateThreshold(2);

            const balances = makeBalances([fix.admin]);
            const tree = new BalanceTree(balances);
            await fix.merkleDistributor.connect(fix.accounts[1]).updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1);
            await fix.merkleDistributor.updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1);

            expect(await fix.merkleDistributor.ownerOf(1)).to.equal(fix.admin.address);
            await expect(fix.merkleDistributor.approve(fix.accounts[1].address, 1)).not.reverted;
            expect(await fix.merkleDistributor.getApproved(1)).to.equal(fix.accounts[1].address);
            await expect(fix.merkleDistributor.connect(fix.accounts[3])
                .transferFrom(fix.admin.address, fix.accounts[2].address, 1))
                .revertedWith("ERC721: transfer caller is not owner nor approved");
            await expect(fix.merkleDistributor.connect(fix.accounts[1])
                .transferFrom(fix.admin.address, fix.accounts[2].address, 1)).not.reverted;
            expect(await fix.merkleDistributor.ownerOf(1)).to.equal(fix.accounts[2].address);

            expect(await fix.merkleDistributor.tokenURI(1)).to.equal(`${tree.getHexRoot()}.json`);
        });
    });
});
