// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IMerkleDistributor.sol";
import "./interfaces/IGovernance.sol";
import "./lib/AccessControl.sol";
import "./lib/MerkleProof.sol";

contract MerkleDistributor is IMerkleDistributor, AccessControl {
    /// @notice Emitted when governance address changes
    event GovernanceChanged(address from, address to);

    /// @notice Role allowing the merkle root to be updated
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    /// @notice Role to slash earned rewards
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    /// @notice Role to distribute rewards to accounts
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    /// @notice The token collection name
    string public constant override name = "Project X Distribution";

    /// @notice The token collection symbol
    string public constant override symbol = "PXD";

    /// @notice Token distribured by this contract
    IERC20Mintable public immutable override token;

    /// @notice Root of a merkle tree containing total earned amounts
    bytes32 public override merkleRoot;

    /// @notice Total number of distributions, also token id of the current distribution
    uint256 public override distributionCount;

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
    constructor(IERC20Mintable token_, address governance_, address admin) {
        token = token_;
        previousMerkleRoot[merkleRoot] = true;

        _setGovernance(governance_);
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
    function updateMerkleRoot(bytes32 _merkleRoot, string calldata uri) external override onlyUpdaters returns (uint256) {
        require(!previousMerkleRoot[_merkleRoot], "MerkleDistributor: Cannot update to a previous merkle root");
        uint256 distributionNumber = distributionCount + 1;

        // make state changes
        merkleRoot = _merkleRoot;
        previousMerkleRoot[_merkleRoot] = true;
        distributionCount = distributionNumber;
        _tokenURI[distributionNumber] = uri;

        emit Transfer(address(0), address(this), distributionNumber);
        emit PermanentURI(uri, distributionNumber);
        emit MerkleRootUpdated(_merkleRoot, distributionNumber, uri);

        return distributionNumber;
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
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IERC721).interfaceId
            || interfaceId == type(IERC721Metadata).interfaceId
            || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the number of tokens in `owner`'s account.
     */
    function balanceOf(address owner) public view override returns (uint256) {
        require(owner != address(0), "MerkleDistributor: balance query for the zero address");
        return owner == address(this) ? distributionCount : 0;
    }

    /**
     * @dev Returns whether `tokenId` exists.
     *
     */
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return tokenId > 0 && tokenId <= distributionCount;
    }

    /**
     * @notice Returns the owner of the `tokenId` token.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        require(_exists(tokenId), "MerkleDistributor: nonexistent token");
        return address(this);
    }

    /**
     * @notice Returns the Uniform Resource Identifier (URI) for `tokenId` token.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "MerkleDistributor: nonexistent token");
        return _tokenURI[tokenId];
    }

    /**
     * @notice Returns the total amount of tokens stored by the contract.
     */
    function totalSupply() override external view returns (uint256) {
        return distributionCount;
    }

    /**
     * @notice Returns a token ID owned by `owner` at a given `index` of its token list.
     * Use along with {balanceOf} to enumerate all of ``owner``'s tokens.
     */
    function tokenOfOwnerByIndex(address owner, uint256 index) override external view returns (uint256 tokenId) {
        require(owner == address(this) && _exists(index + 1), "MerkleDistributor: nonexistent token");
        return index + 1;
    }

    /**
     * @notice Returns a token ID at a given `index` of all the tokens stored by the contract.
     * Use along with {totalSupply} to enumerate all tokens.
     */
    function tokenByIndex(uint256 index) override external view returns (uint256) {
        require(_exists(index + 1), "MerkleDistributor: nonexistent token");
        return index + 1;
    }

    /// @dev Throw indicating an unsupported ERC-721 action
    function unsupportedERC721() pure private {
        revert("MerkleDistributor: Unsupported ERC-721 action");
    }

    function approve(address, uint256) public virtual override { unsupportedERC721(); }
    function getApproved(uint256) public view virtual override returns (address) { unsupportedERC721(); }
    function setApprovalForAll(address, bool) public virtual override { unsupportedERC721(); }
    function isApprovedForAll(address, address) public view virtual override returns (bool) { unsupportedERC721(); }
    function transferFrom(address, address, uint256) public virtual override { unsupportedERC721(); }
    function safeTransferFrom(address, address, uint256) public virtual override { unsupportedERC721(); }
    function safeTransferFrom(address, address, uint256, bytes memory) public virtual override { unsupportedERC721(); }
}