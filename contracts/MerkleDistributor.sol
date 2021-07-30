// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IMerkleDistributor.sol";
import "./interfaces/IGovernance.sol";
import "./lib/AccessControl.sol";
import "./lib/MerkleProof.sol";
import "./lib/ERC721Enumerable.sol";

contract MerkleDistributor is IMerkleDistributor, AccessControl, ERC721Enumerable {
    /// @notice Emitted when governance address changes
    event GovernanceChanged(address from, address to);

    /// @notice Emitted when update threshold changes    
    event UpdateThresholdChanged(uint256 updateThreshold);

    /// @notice Role allowing the merkle root to be updated
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    /// @notice Role to slash earned rewards
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    /// @notice Role to distribute rewards to accounts
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    /// @notice Token distribured by this contract
    IERC20Mintable public immutable override token;

    /// @notice Root of a merkle tree containing total earned amounts
    bytes32 public override merkleRoot;

    /// @notice Total number of distributions, also token id of the current distribution
    uint256 public override distributionCount;

    /// @notice Number of votes from updaters needed to apply a new root
    uint256 public updateThreshold;

    /// @notice Governance address
    address public governance;

    /// @notice Properties of each account -- totalEarned is stored in merkle tree
    struct AccountState {
        uint256 totalClaimed;
        uint256 totalSlashed;
    }

    /// @notice Account state
    mapping(address => AccountState) public override accountState;

    /// @dev Historical merkle roots
    mapping(bytes32 => bool) public override previousMerkleRoot;

    /// @dev Path to distribution metadata (including proofs)
    mapping(uint256 => string) private _tokenURI;

    /// @dev Votes for a new merkle root
    mapping(bytes32 => uint256) private _updateVotes;

    /// @dev Vote for new merkle root for each distribution
    mapping(address => mapping(uint256 => bytes32)) private _updaterVotes;

    /// @dev Modifier to restrict functions to only updaters
    modifier onlyUpdaters() {
        require(hasRole(UPDATER_ROLE, msg.sender), "MerkleDistributor: Caller must have UPDATER_ROLE");
        _;
    }

    /// @dev Modifier to restrict functions to only slashers
    modifier onlySlashers() {
        require(hasRole(SLASHER_ROLE, msg.sender), "MerkleDistributor: Caller must have SLASHER_ROLE");
        _;
    }

    /// @dev Modifier to restrict functions to only admins
    modifier onlyAdmins() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "MerkleDistributor: Caller must have DEFAULT_ADMIN_ROLE");
        _;
    }

    /**
     * @dev Initialize contact, `DEFAULT_ADMIN_ROLE` will be set to the
     * account that deploys the contract.
     */
    constructor(IERC20Mintable token_, address governance_, address admin, uint256 updateThreshold_) ERC721("Eden Network Distribution", "EDEND") {
        token = token_;
        previousMerkleRoot[merkleRoot] = true;

        _setGovernance(governance_);
        _setUpdateThreshold(updateThreshold_);
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @dev Apply a governance change
     */
    function _setGovernance(address to) private {
        require(to != governance, "MerkleDistributor: Governance address not changed");
        emit GovernanceChanged(governance, to);
        governance = to;
    }

    /**
     * @notice Change the governance address
     *
     * Requirements:
     *
     * - the caller must have the `DEFAULT_ADMIN_ROLE`.
     */
    function setGovernance(address to) onlyAdmins public {
        _setGovernance(to);
    }

    /**
     * @dev Apply a threshold change
     */
    function _setUpdateThreshold(uint256 to) private {
        require(to != 0, "MerkleDistributor: Update threshold must be non-zero");
        emit UpdateThresholdChanged(to);
        updateThreshold = to;
    }

    /**
     * @notice Change the update threshold
     *
     * Requirements:
     *
     * - the caller must have the `DEFAULT_ADMIN_ROLE`.
     */
    function setUpdateThreshold(uint256 to) onlyAdmins public {
        _setUpdateThreshold(to);
    }
    
    /**
     * @dev Increase claimed and account amounts for `account`
     */
    function _increaseAccount(address account, uint256 claimed, uint256 slashed) private {
        // Increase balances
        if (claimed != 0)
            accountState[account].totalClaimed += claimed;
        if (slashed != 0)
            accountState[account].totalSlashed += slashed;

        if (claimed != 0 || slashed != 0)
            emit AccountUpdated(account, accountState[account].totalClaimed, accountState[account].totalSlashed);
    }

    /**
     * @notice Claim all unclaimed tokens
     *
     * Given a merkle proof of (index, account, totalEarned), claim all
     * unclaimed tokens. Unclaimed tokens are the difference between the total
     * earned tokens (provided in the merkle tree) and those that have been
     * either claimed or slashed.
     *
     * Note: it is possible for the claimed and slashed tokens to exceeed
     * the total earned tokens, particularly when a slashing has occured.
     * In this case no tokens are claimable until total earned has exceeded
     * the sum of the claimed and slashed.
     *
     * If no tokens are claimable, this function will revert.
     */
    function claim(uint256 index, address account, uint256 totalEarned, bytes32[] calldata merkleProof) external override {
        require(governance != address(0), "MerkleDistributor: Governance not set");

        // Verify caller is authorized and select beneficiary
        address beneficiary = msg.sender;
        if (msg.sender != account) {
            address collector = IGovernance(governance).rewardCollector(account);

            if (!hasRole(DISTRIBUTOR_ROLE, msg.sender))
                require(msg.sender == collector, "MerkleDistributor: Cannot collect rewards");
            else
                beneficiary = collector == address(0) ? account : collector; 
        }

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(index, account, totalEarned));
        require(MerkleProof.verify(merkleProof, merkleRoot, node), "MerkleDistributor: Invalid proof");

        // Calculate the claimable balance
        uint256 alreadyDistributed = accountState[account].totalClaimed + accountState[account].totalSlashed;
        require(totalEarned > alreadyDistributed, "MerkleDistributor: Nothing claimable");
        uint256 claimable = totalEarned - alreadyDistributed;
        emit Claimed(index, totalEarned, account, claimable);

        // Apply account changes and transfer unclaimed tokens
        _increaseAccount(account, claimable, 0);
        require(token.mint(beneficiary, claimable), "MerkleDistributor: Mint failed");
    }

    /**
     * @notice Set a new merkle root and mints NFT with metadata URI to retreive the full tree
     *
     * Requirements:
     *
     * - caller must have `UPDATER_ROLE` 
     */
    function updateMerkleRoot(bytes32 _merkleRoot, string calldata uri, uint256 _distributionNumber) external override onlyUpdaters returns (uint256) {
        require(!previousMerkleRoot[_merkleRoot], "MerkleDistributor: Cannot update to a previous merkle root");
        uint256 distributionNumber = distributionCount + 1;
        require(distributionNumber == _distributionNumber, "MerkleDistributor: Can only update next distribution");
        require(_updaterVotes[msg.sender][distributionNumber] == bytes32(0), "MerkleDistributor: Updater already submitted new root");

        _updaterVotes[msg.sender][distributionNumber] = _merkleRoot;
        uint256 votes = _updateVotes[_merkleRoot] + 1;
        _updateVotes[_merkleRoot] = votes;

        if (votes == updateThreshold) {
            merkleRoot = _merkleRoot;
            previousMerkleRoot[_merkleRoot] = true;
            distributionCount = distributionNumber;
            _tokenURI[distributionNumber] = uri;

            _mint(msg.sender, distributionNumber);
            emit PermanentURI(uri, distributionNumber);
            emit MerkleRootUpdated(_merkleRoot, distributionNumber, uri);

            return distributionNumber;
        }
        else
            return distributionCount;
    }

    /**
     * @notice Slash `account` for `amount` tokens.
     *
     * Accounts may be slashed more than their total earned tokens, see {claim}.
     *
     * Requirements:
     *
     * - caller must have `SLASHERS_ROLE`
     */
    function slash(address account, uint256 amount) external override onlySlashers {
        emit Slashed(account, amount);
        _increaseAccount(account, 0, amount);
    }

    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, IERC165, ERC721Enumerable) returns (bool) {
        return interfaceId == type(IERC721).interfaceId
            || interfaceId == type(IERC721Metadata).interfaceId
            || interfaceId == type(IERC721Enumerable).interfaceId
            || super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override(ERC721, IERC721Metadata) returns (string memory) {
        require(_exists(tokenId), "ERC721URIStorage: URI query for nonexistent token");

        string memory uri = _tokenURI[tokenId];
        string memory base = _baseURI();

        // If there is no base URI, return the token URI.
        if (bytes(base).length == 0) {
            return uri;
        }
        // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
        if (bytes(uri).length > 0) {
            return string(abi.encodePacked(base, uri));
        }

        return super.tokenURI(tokenId);
    }
}
