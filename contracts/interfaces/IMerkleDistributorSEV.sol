// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IMerkleDistributorBase.sol";

interface IMerkleDistributorSEV is IMerkleDistributorBase {
    function updateMerkleRoot(bytes32 newMerkleRoot, string calldata uri, uint256 newDistributionNumber, uint256 tokenTotal) external returns (uint256);
    event MerkleRootUpdated(bytes32 merkleRoot, uint256 distributionNumber, string metadataURI, uint256 tokenTotal);
    event DebtChanged(uint256 oldDebt, uint256 newDebt);
}
