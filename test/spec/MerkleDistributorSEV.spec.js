const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { distributorSEVFixture } = require("../fixtures");
const BalanceTree = require("../../scripts/utils/balanceTree");

const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
const UPDATER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPDATER_ROLE"));
const SLASHER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SLASHER_ROLE"));
const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));

function makeBalances(accounts) {
    return accounts.map((account, index) => { return {
        account: account.address,
        signer: account,
        amount: ethers.utils.parseUnits((1337 / Math.pow(10, index)).toFixed(18))
    }});
}

describe("MerkleDistributorSEV", () => {
    let fix;

    beforeEach(async () => {
        fix = await distributorSEVFixture();
    });

    context("constructor", () => {
        it("initial state", async () => {
            expect(await fix.merkleDistributorSEV.hasRole(DEFAULT_ADMIN_ROLE, fix.admin.address)).true;
            expect(await fix.merkleDistributorSEV.hasRole(UPDATER_ROLE, fix.admin.address)).true;
            expect(await fix.merkleDistributorSEV.hasRole(SLASHER_ROLE, fix.admin.address)).false;

            expect(await fix.merkleDistributorSEV.distributionCount()).equal(0);
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(ethers.constants.HashZero);
        });
    });

    context("updateMerkleRoot", () => {
        it("updater can call", async () => {
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(
                ethers.utils.id(ethers.utils.id(ethers.constants.HashZero)), `${ethers.constants.HashZero}.json`, 1, 0)).not.reverted;
        });

        it("non-updater cannot call", async () => {
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(
                ethers.constants.HashZero, `${ethers.constants.HashZero}.json`, 1, 0))
                .revertedWith("MerkleDistributorSEV: Caller must have UPDATER_ROLE");
        });

        it("new roots take effect and NFTs are minted while old NFT is still valid", async () => {
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);

            const epoch = (await fix.merkleDistributorSEV.distributionCount()).toNumber();

            const root = ethers.utils.id("I've never been to Mars, but I imagine it's quite nice.");
            await fix.merkleDistributorSEV.updateMerkleRoot(root, `${root}.json`, 1, 0);
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root, `${root}.json`, 1, 0);
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root);
            expect(await fix.merkleDistributorSEV.tokenURI(epoch + 1)).equal(`${root}.json`);
            expect(await fix.merkleDistributorSEV.ownerOf(epoch + 1)).equal(fix.accounts[1].address);

            const root2 = ethers.utils.id("You know how to take the reservation, you just don't know how to hold the reservation.");
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root2, `${root2}.json`, 2, 0);
            await fix.merkleDistributorSEV.updateMerkleRoot(root2, `${root2}.json`, 2, 0);
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root2);
            expect(await fix.merkleDistributorSEV.tokenURI(epoch + 2)).equal(`${root2}.json`);
            expect(await fix.merkleDistributorSEV.ownerOf(epoch + 2)).equal(fix.admin.address);

            expect(await fix.merkleDistributorSEV.tokenURI(epoch + 1)).equal(`${root}.json`);
            expect(await fix.merkleDistributorSEV.ownerOf(epoch + 1)).equal(fix.accounts[1].address);
        });

        it("cannot apply a previous root", async () => {
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);

            const root = ethers.utils.id("The sea was angry that day, my friends.");
            await fix.merkleDistributorSEV.updateMerkleRoot(root, `${root}.json`, 1, 0);
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root, `${root}.json`, 1, 0);
            expect(await fix.merkleDistributorSEV.previousMerkleRoot(root)).true;

            const root2 = ethers.utils.id("Like an old man trying to send back soup in a deli.");
            await fix.merkleDistributorSEV.updateMerkleRoot(root2, `${root2}.json`, 2, 0);
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root2, `${root2}.json`, 2, 0);
            expect(await fix.merkleDistributorSEV.previousMerkleRoot(root)).true;
            expect(await fix.merkleDistributorSEV.previousMerkleRoot(root2)).true;

            const root3 = ethers.utils.id("I got about fifty feet out")
            expect(await fix.merkleDistributorSEV.previousMerkleRoot(root3)).false;
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(root, `${root}.json`, 3, 0));
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root, `${root}.json`, 3, 0))
                .revertedWith("MerkleDistributorSEV: Cannot update to a previous merkle root");
        });

        it("can only update for next distribution", async () => {
            const root = ethers.utils.id("Suddenly, the great beast appeared before me!");
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(root, `${root}.json`, 2, 0))
                .revertedWith("MerkleDistributorSEV: Can only update next distribution");
        });

        it("same updater cannot update twice for same distribution", async () => {
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);

            const root = ethers.utils.id("I tell you, he was ten stories high if he was a foot.");
            await fix.merkleDistributorSEV.updateMerkleRoot(root, `${root}.json`, 1, 0);
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(root, `${root}.json`, 1, 0))
                .revertedWith("MerkleDistributorSEV: Updater already submitted new root");
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(ethers.constants.HashZero);
        })

        it("disagreement", async () => {
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[2].address);
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[3].address);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);

            const root = ethers.utils.id("As if sensing my presence, he let out a great bellow.");
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(root, `${root}.json`, 1, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(ethers.constants.HashZero);

            const root2 = ethers.utils.id("I said, \"Easy, big fella!\"");
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root2, `${root2}.json`, 1, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(ethers.constants.HashZero);

            await expect(fix.merkleDistributorSEV.connect(fix.accounts[2]).updateMerkleRoot(root, `${root}.json`, 1, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root);

            await expect(fix.merkleDistributorSEV.connect(fix.accounts[3]).updateMerkleRoot(root2, `${root2}.json`, 1, 0))
                .revertedWith("MerkleDistributorSEV: Can only update next distribution");
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root);

            const root3 = ethers.utils.id("I realized that something was obstructing its breathing.");
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root3, `${root3}.json`, 2, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root);

            await expect(fix.merkleDistributorSEV.connect(fix.accounts[3]).updateMerkleRoot(root, `${root}.json`, 2, 0))
                .revertedWith("MerkleDistributorSEV: Cannot update to a previous merkle root");

            await expect(fix.merkleDistributorSEV.connect(fix.accounts[3]).updateMerkleRoot(root3, `${root3}.json`, 2, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root3);
        });

        it("changed threshold takes effect", async () => {
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[2].address);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);

            const root = ethers.utils.id("I could see directly into the eye of the great fish.");
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(root, `${root}.json`, 1, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(ethers.constants.HashZero);
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root, `${root}.json`, 1, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root);

            await fix.merkleDistributorSEV.setUpdateThreshold(3);

            const root2 = ethers.utils.id("Mammal.");
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(root2, `${root2}.json`, 2, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root);
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(root2, `${root2}.json`, 2, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root);
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[2]).updateMerkleRoot(root2, `${root2}.json`, 2, 0))
                .not.reverted;
            expect(await fix.merkleDistributorSEV.merkleRoot()).equal(root2);
        });

        it("must fully pre-fund", async () => {
            await fix.edenToken.grantRole(MINTER_ROLE, fix.admin.address);

            await expect(fix.merkleDistributorSEV.updateMerkleRoot(
                ethers.utils.id(ethers.utils.id(ethers.constants.HashZero)), `${ethers.constants.HashZero}.json`, 1, 100))
                .revertedWith("MerkleDistributorSEV: Distribution would leave contract underfunded");

            await fix.edenToken.mint(fix.merkleDistributorSEV.address, 80);
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(
                ethers.utils.id(ethers.utils.id(ethers.constants.HashZero)), `${ethers.constants.HashZero}.json`, 1, 100))
                .revertedWith("MerkleDistributorSEV: Distribution would leave contract underfunded");

            await fix.edenToken.mint(fix.merkleDistributorSEV.address, 21);
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(
                ethers.utils.id(ethers.utils.id(ethers.constants.HashZero)), `${ethers.constants.HashZero}.json`, 1, 100))
                .not.reverted;

            expect(await fix.merkleDistributorSEV.debtTotal()).equal(100);
            expect(await fix.merkleDistributorSEV.balance()).equal(1);
        });
    });

    context("claim", () => {
        it("rewards claimable", async () => {
            await fix.edenToken.grantRole(MINTER_ROLE, fix.admin.address);
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);
            
            const balances = makeBalances(fix.accounts.slice(2));
            const totalRewards = balances.reduce((accumulator, currentValue) => {
                return accumulator.add(currentValue.amount);
            }, BigNumber.from(0));
            const tree = new BalanceTree(balances);

            // update the root but without funding
            await expect(fix.merkleDistributorSEV.updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1, totalRewards))
                .revertedWith("MerkleDistributorSEV: Distribution would leave contract underfunded");
            
            // now fund the contract and update
            await fix.edenToken.mint(fix.merkleDistributorSEV.address, totalRewards);
            expect(await fix.merkleDistributorSEV.balance()).equals(totalRewards);
            expect(await fix.merkleDistributorSEV.debtTotal()).equals(0);
            await fix.merkleDistributorSEV.updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1, totalRewards)
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1, totalRewards);
            expect(await fix.merkleDistributorSEV.balance()).equals(0);
            expect(await fix.merkleDistributorSEV.debtTotal()).equals(totalRewards);
            
            // check that we cannot claim to someone else
            proof = tree.getProof(0, balances[0].account, balances[0].amount);
            await expect(fix.merkleDistributorSEV
                .claim(0, balances[0].account, balances[0].amount, proof))
                .revertedWith("MerkleDistributorSEV: Cannot collect rewards");

            let contractBalance = await fix.merkleDistributorSEV.balance();
            for (const [index, balance] of balances.entries()) {
                const proof = tree.getProof(index, balance.account, balance.amount);

                if (index === 2) {
                    // fund the contract some more part-way through.
                    // this should increase balance but not debt, and these 
                    // extra rewards should not be claimable
                    await fix.edenToken.mint(fix.merkleDistributorSEV.address, 1337);
                    const newContractBalance = await fix.merkleDistributorSEV.balance();
                    expect(newContractBalance.sub(contractBalance)).equals(1337);
                    contractBalance = newContractBalance;
                }

                // claim and verify tokens were transfered

                const beforeContractDebt = await fix.merkleDistributorSEV.debtTotal();

                await expect(fix.merkleDistributorSEV.connect(balance.signer)
                    .claim(index, balance.account, balance.amount, proof))
                    .not.reverted;

                const afterBalance = await fix.edenToken.balanceOf(balance.account);
                const afterContractBalance = await fix.merkleDistributorSEV.balance();
                const afterContractDebt = await fix.merkleDistributorSEV.debtTotal();

                expect(afterBalance).equals(balance.amount);
                expect(afterContractBalance).equals(contractBalance);
                expect(beforeContractDebt.sub(afterContractDebt)).equals(balance.amount);

                // verify they cannot be claimed again
                await expect(fix.merkleDistributorSEV.connect(balance.signer)
                    .claim(index, balance.account, balance.amount, proof))
                    .revertedWith("MerkleDistributorSEV: Nothing claimable");
            }

            // all tokens should have been distributed, except for the extra funding
            expect(await fix.edenToken.balanceOf(fix.merkleDistributorSEV.address)).eq(1337);

            // now, set a new root with all balances increased by 1, except for the last
            // account, which will get no new balance. should only be able to claim the increase
            const newBalances = balances.slice(0, balances.length - 1).map(x => { return {
                ...x,
                amount: x.amount.add(1)
            }});
            newBalances.push(balances[balances.length - 1]);
            const newTotalRewards = totalRewards.add(balances.length - 1);
            const newTree = new BalanceTree(newBalances);

            // verify we have enough funding for this, and don't need to mint any more
            const newDebt = newTotalRewards.sub(totalRewards);
            expect(contractBalance).gt(newDebt);

            // apply the new root
            await fix.merkleDistributorSEV.updateMerkleRoot(newTree.getHexRoot(), `${newTree.getHexRoot()}.json`, 2, newTotalRewards);
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(newTree.getHexRoot(), `${newTree.getHexRoot()}.json`, 2, newTotalRewards);

            expect(await fix.merkleDistributorSEV.debtTotal()).equals(newDebt);
            contractBalance = await fix.merkleDistributorSEV.balance();

            // claim two addresses
            for (let index = 0 ; index < 2 ; ++index) {
                const balance = newBalances[index];
                const proof = newTree.getProof(index, balance.account, balance.amount);

                // claim and verify tokens were transfered

                const beforeBalance = await fix.edenToken.balanceOf(balance.account);
                const beforeContractDebt = await fix.merkleDistributorSEV.debtTotal();

                await expect(fix.merkleDistributorSEV.connect(balance.signer)
                    .claim(index, balance.account, balance.amount, proof))
                    .not.reverted;

                const afterBalance = await fix.edenToken.balanceOf(balance.account);
                const afterContractBalance = await fix.merkleDistributorSEV.balance();
                const afterContractDebt = await fix.merkleDistributorSEV.debtTotal();

                expect(afterBalance).equals(balance.amount);
                expect(afterContractBalance).equals(contractBalance);
                expect(beforeContractDebt.sub(afterContractDebt)).equals(afterBalance.sub(beforeBalance));
            }

            expect(await fix.merkleDistributorSEV.debtTotal()).equals(newDebt.sub(2));
            expect(await fix.merkleDistributorSEV.balance()).equals(contractBalance);

            // a third distribution adding one to everyone
            const newNewBalances = newBalances.map(x => { return {
                ...x,
                amount: x.amount.add(1)
            }});
            const newNewTotalRewards = newTotalRewards.add(newBalances.length);
            const newNewTree = new BalanceTree(newNewBalances);

            // verify we have enough funding for this, and don't need to mint any more
            const newNewDebt = newNewTotalRewards.sub(newTotalRewards);
            expect(contractBalance).gt(newNewDebt);

            // apply the new root
            await fix.merkleDistributorSEV.updateMerkleRoot(newNewTree.getHexRoot(), `${newNewTree.getHexRoot()}.json`, 3, newNewTotalRewards);
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(newNewTree.getHexRoot(), `${newNewTree.getHexRoot()}.json`, 3, newNewTotalRewards);

            expect(await fix.merkleDistributorSEV.debtTotal()).equals(newDebt.sub(2).add(newNewDebt));
            contractBalance = await fix.merkleDistributorSEV.balance();

            // claim all but the first two addresses
            for (let index = 2 ; index < newNewBalances.length ; ++index) {
                const balance = newNewBalances[index];
                const proof = newNewTree.getProof(index, balance.account, balance.amount);

                // claim and verify tokens were transfered

                const beforeBalance = await fix.edenToken.balanceOf(balance.account);
                const beforeContractDebt = await fix.merkleDistributorSEV.debtTotal();

                await expect(fix.merkleDistributorSEV.connect(balance.signer)
                    .claim(index, balance.account, balance.amount, proof))
                    .not.reverted;

                const afterBalance = await fix.edenToken.balanceOf(balance.account);
                const afterContractBalance = await fix.merkleDistributorSEV.balance();
                const afterContractDebt = await fix.merkleDistributorSEV.debtTotal();

                expect(afterBalance).equals(balance.amount);
                expect(afterContractBalance).equals(contractBalance);
                expect(beforeContractDebt.sub(afterContractDebt)).equals(afterBalance.sub(beforeBalance));
            }

            expect(await fix.merkleDistributorSEV.debtTotal()).equals(2);

            // check that old valid claims do not work
            const lastBalance = balances[balances.length - 1];
            const lastProof = tree.getProof(balances.length - 1, lastBalance.account, lastBalance.amount);
            await expect(fix.merkleDistributorSEV.connect(lastBalance.signer)
                .claim(balances.length - 1, lastBalance.account, lastBalance.amount, lastProof))
                .revertedWith("MerkleDistributorSEV: Invalid proof");
        });
    });

    context("setUpdateThreshold", () => {
        it("admin can call and change takes effect", async () => {
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            expect(await fix.merkleDistributorSEV.updateThreshold()).equal(1);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);
            expect(await fix.merkleDistributorSEV.updateThreshold()).equal(2);
        });

        it("non-admin cannot call", async () => {
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[1]).setUpdateThreshold(2))
                .revertedWith("MerkleDistributorSEV: Caller must have DEFAULT_ADMIN_ROLE");
        });

        it("cannot set a zero threshold", async () => {
            await expect(fix.merkleDistributorSEV.setUpdateThreshold(0))
                .revertedWith("MerkleDistributorSEV: Update threshold must be non-zero");
        });

        it("cannot set a threshold greater than accounts with UPDATER_ROLE", async () => {
            await expect(fix.merkleDistributorSEV.setUpdateThreshold(2))
                .revertedWith("MerkleDistributorSEV: threshold > updaters");
        })
    })

    context("erc721", () => {
        it("initial state", async () => {
            expect(await fix.merkleDistributorSEV.totalSupply()).to.equal(0);

            for (const i of [0, 1]) {
                await expect(fix.merkleDistributorSEV.ownerOf(i)).revertedWith("ERC721: owner query for nonexistent token");
                await expect(fix.merkleDistributorSEV.tokenURI(i)).revertedWith("ERC721URIStorage: URI query for nonexistent toke");
                await expect(fix.merkleDistributorSEV.tokenByIndex(i)).revertedWith("ERC721Enumerable: global index out of bounds");
                await expect(fix.merkleDistributorSEV.tokenOfOwnerByIndex(
                    fix.merkleDistributorSEV.address, i)).revertedWith("ERC721Enumerable: owner index out of bounds");
            }
        });

        it("properties", async () => {
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);

            const balances = makeBalances([fix.admin]);
            const tree = new BalanceTree(balances);
            await fix.merkleDistributorSEV.updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1, 0);
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1, 0);

            expect(await fix.merkleDistributorSEV.totalSupply()).to.equal(1);
            expect(await fix.merkleDistributorSEV.ownerOf(1)).to.equal(fix.accounts[1].address);
            expect(await fix.merkleDistributorSEV.tokenByIndex(0)).to.equal(1);
            expect(await fix.merkleDistributorSEV.tokenOfOwnerByIndex(fix.accounts[1].address, 0)).to.equal(1);
            expect(await fix.merkleDistributorSEV.tokenURI(1)).to.equal(`${tree.getHexRoot()}.json`);

            await fix.merkleDistributorSEV.updateMerkleRoot(ethers.utils.id(tree.getHexRoot()), `${tree.getHexRoot()}.json`, 2, 0);
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(ethers.utils.id(tree.getHexRoot()), `${tree.getHexRoot()}.json`, 2, 0);

            expect(await fix.merkleDistributorSEV.totalSupply()).to.equal(2);
            expect(await fix.merkleDistributorSEV.ownerOf(2)).to.equal(fix.accounts[1].address);
            expect(await fix.merkleDistributorSEV.tokenByIndex(1)).to.equal(2);
            expect(await fix.merkleDistributorSEV.tokenOfOwnerByIndex(fix.accounts[1].address, 1)).to.equal(2);
            expect(await fix.merkleDistributorSEV.tokenURI(2)).to.equal(`${tree.getHexRoot()}.json`);
        });

        it("transfer", async () => {
            await fix.merkleDistributorSEV.grantRole(UPDATER_ROLE, fix.accounts[1].address);
            await fix.merkleDistributorSEV.setUpdateThreshold(2);

            const balances = makeBalances([fix.admin]);
            const tree = new BalanceTree(balances);
            await fix.merkleDistributorSEV.connect(fix.accounts[1]).updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1, 0);
            await fix.merkleDistributorSEV.updateMerkleRoot(tree.getHexRoot(), `${tree.getHexRoot()}.json`, 1, 0);

            expect(await fix.merkleDistributorSEV.ownerOf(1)).to.equal(fix.admin.address);
            await expect(fix.merkleDistributorSEV.approve(fix.accounts[1].address, 1)).not.reverted;
            expect(await fix.merkleDistributorSEV.getApproved(1)).to.equal(fix.accounts[1].address);
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[3])
                .transferFrom(fix.admin.address, fix.accounts[2].address, 1))
                .revertedWith("ERC721: transfer caller is not owner nor approved");
            await expect(fix.merkleDistributorSEV.connect(fix.accounts[1])
                .transferFrom(fix.admin.address, fix.accounts[2].address, 1)).not.reverted;
            expect(await fix.merkleDistributorSEV.ownerOf(1)).to.equal(fix.accounts[2].address);

            expect(await fix.merkleDistributorSEV.tokenURI(1)).to.equal(`${tree.getHexRoot()}.json`);
        });
    });
});
