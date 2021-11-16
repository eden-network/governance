// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IMerkleDistributorBase.sol";

interface IMerkleDistributor is IMerkleDistributorBase {
    function updateMerkleRoot(bytes32 newMerkleRoot, string calldata uri, uint256 newDistributionNumber) external returns (uint256);
    function setGovernance(address to) external;
    event MerkleRootUpdated(bytes32 merkleRoot, uint256 distributionNumber, string metadataURI);
    event GovernanceChanged(address from, address to);
}
