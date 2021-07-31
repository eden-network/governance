[![MythXBadge](https://badgen.net/https/api.mythx.io/v1/projects/d39258a9-1656-4b0f-867d-d67d0632c976/badge/data?cache=300&icon=https://raw.githubusercontent.com/ConsenSys/mythx-github-badge/main/logo_white.svg)](https://docs.mythx.io/dashboard/github-badges)
[![Discord](https://img.shields.io/discord/761540124940697600?color=blue&label=Discord&logo=Discord)](https://discord.com/channels/761540124940697600/761540124940697604)

# Contract Overview

Eden Network is a series of Ethereum smart contracts governed by EDEN token holders.

The initial set of smart contracts form the base for controlling product decisions and configurations for the broader Eden product.


# Smart Contracts

The initial set of smart contracts deployed for Eden Network:
- EDEN Token Contract
- Migrator
- Eden Network
- Eden Network Proxy
- Eden Network Manager
- Voting Power Prism (Proxy)
- Voting Power Implementation Contract
- Vault
- Token Registry
- Lock Manager
- Rewards Manager
- Merkle Distributor
- Distributor Governance


## EDEN Token

The EDEN token is ERC-20 compliant, with add-ons to allow for offchain signing for approvals + transfers (see [EIP-712](https://eips.ethereum.org/EIPS/eip-712), [EIP-2612](https://eips.ethereum.org/EIPS/eip-2612), and [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009)). The contract is not upgradable and uses immutable logic. The immutable logic includes configurations for modifying total supply and token metadata.

## Migrator

One way migration contract for upgrading ARCH tokens to EDEN tokens.

## Eden Network

This is the primary contract for interfacing with the Eden Network. Users can bid on slots via a continuous auction (Harberger tax) giving them priority access to block space on the Ethereum network + stake EDEN to access protected transactions on the Eden Network.

## Eden Network Proxy

Standard Transparent proxy for interfacing with the Eden Network

## Eden Network Manager

Manager contract for the Eden Network Proxy

## Vault

The Vault contract allows locking up of multiple token balances per user for a given period of time - optionally providing voting power

Vesting is linear and continuous, with an optional cliff. Vested balances may only be claimed by the Lock recipient.

## Voting Power Prism (Proxy)

The Voting Power Prism proxy contract keeps track of how many votes each DAO member has.

Voting Power increases when tokens are staked. Voting Power decreases when tokens are unstaked. Balances in the Token Vesting contract are considered staked for the purpose of Voting Power calculations.

Voting Power snapshots are stored following the Diamond Storage technique outlined by the Diamond Standard (see [EIP-2535](https://eips.ethereum.org/EIPS/eip-2535)). This ensures that snapshots remain available even if the underlying logic to form snapshots changes. Additional contracts may be developed and deployed by the community to modify how Voting Power is tracked.


## Voting Power Implementation Contract

The Voting Power Implementation contract determines how votes are recorded for snapshots.

## Token Registry

The Token Registry contract maintains a list of "Token Formula" contracts that are used to convert token amounts to their corresponding voting power within Eden Network.

## Lock Manager

Lock Manager keeps track of tokens that are locked up within the Eden ecosystem (somewhere other than in the Voting Power Prism) and the resulting voting power from these locked balances.

Special contracts with the "LOCKER_ROLE" role are in charge of maintaining these locked balances and calling the functions to add or remove voting power.

## Rewards Manager

The Rewards Manager is responsible for distributing EDEN (and optionally, SUSHI) rewards to users who provide EDEN liquidity to approved markets or otherwise benefit the  Eden Network as decided by the DAO.

## Merkle Distributor

The Merkle Distributor contract is in charge of distributing rewards to miners that are participating in the network.  Merkle proofs are submitted to the contract representing the reward distribution and miners claim these rewards directly via the contract.

## Distributor Governance

The Distributor Governance contract is used to add and remove miners from the network and configure reward parameters.