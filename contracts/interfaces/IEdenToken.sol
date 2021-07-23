// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IEdenToken is IERC20 {
    function updateTokenMetadata(string memory tokenName, string memory tokenSymbol) external returns (bool);
    function metadataManager() external view returns (address);
    function setMetadataManager(address newMetadataManager) external returns (bool);
    event MetadataManagerChanged(address indexed oldManager, address indexed newManager);
    event TokenMetaUpdated(string indexed name, string indexed symbol);
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
}