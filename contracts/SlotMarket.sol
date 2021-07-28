// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IERC20Extended.sol";
import "./lib/Initializable.sol";

/**
 * @title SlotMarket
 * @dev It is VERY IMPORTANT that modifications to this contract do not change the storage layout of the existing variables.  
 * Be especially careful when importing any external contracts/libraries.
 * If you do not know what any of this means, BACK AWAY FROM THE CODE NOW!!
 */
contract SlotMarket is Initializable {
    struct Bid {
        address bidder;
        uint16 taxNumerator;
        uint16 taxDenominator;
        uint64 periodStart;
        uint128 bidAmount;
    }

    mapping (uint8 => uint64) public slotExpiration;
    mapping (uint8 => address) private _slotDelegate;
    mapping (uint8 => address) private _slotOwner;
    mapping (uint8 => Bid) public slotBid;
    mapping (address => uint128) public stakedBalance;

    IERC20Extended public token;
    address public admin;
    uint16 public taxNumerator;
    uint16 public taxDenominator;
    uint128 public MIN_BID;

    uint256 private _NOT_ENTERED;
    uint256 private _ENTERED;
    uint256 private _status;

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    modifier onlySlotOwner(uint8 slot) {
        require(msg.sender == slotOwner(slot), "not slot owner");
        _;
    }

    modifier nonReentrant() {
        // On the first call to nonReentrant, _notEntered will be true
        require(_status != _ENTERED, "reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    event AdminUpdated(address indexed newAdmin, address indexed oldAdmin);
    event TaxRateUpdated(uint16 newNumerator, uint16 newDenominator, uint16 oldNumerator, uint16 oldDenominator);
    event SlotClaimed(uint8 indexed slot, address indexed owner, address indexed delegate, uint128 newBidAmount, uint128 oldBidAmount, uint16 taxNumerator, uint16 taxDenominator);
    event SlotDelegateUpdated(uint8 indexed slot, address indexed owner, address indexed newDelegate, address oldDelegate);
    event Stake(address indexed claimer, uint256 stakeAmount);
    event Unstake(address indexed staker, uint256 unstakedAmount);

    function initialize(
        IERC20Extended _token,
        address _admin,
        uint16 _taxNumerator,
        uint16 _taxDenominator
    ) public initializer {
        token = _token;
        admin = _admin;
        emit AdminUpdated(_admin, address(0));

        taxNumerator = _taxNumerator;
        taxDenominator = _taxDenominator;
        emit TaxRateUpdated(_taxNumerator, _taxDenominator, 0, 0);

        MIN_BID = 10000000000000000;
        _NOT_ENTERED = 1;
        _ENTERED = 2;
        _status = _NOT_ENTERED;
    }

    function slotOwner(uint8 slot) public view returns (address) {
        if(slotForeclosed(slot)) {
            return address(0);
        }
        return _slotOwner[slot];
    }

    function slotDelegate(uint8 slot) public view returns (address) {
        if(slotForeclosed(slot)) {
            return address(0);
        }
        return _slotDelegate[slot];
    }

    function slotCost(uint8 slot) external view returns (uint128) {
        if(slotForeclosed(slot)) {
            return MIN_BID;
        }

        Bid memory currentBid = slotBid[slot];
        return currentBid.bidAmount * 110 / 100;
    }

    function claimSlot(
        uint8 slot, 
        uint128 bid, 
        address delegate
    ) external nonReentrant {
        _claimSlot(slot, bid, delegate);
    }

    function claimSlotWithPermit(
        uint8 slot, 
        uint128 bid, 
        address delegate, 
        uint256 deadline, 
        uint8 v, 
        bytes32 r, 
        bytes32 s
    ) external nonReentrant {
        token.permit(msg.sender, address(this), bid, deadline, v, r, s);
        _claimSlot(slot, bid, delegate);
    }

    function slotBalance(uint8 slot) public view returns (uint128 balance) {
        Bid memory currentBid = slotBid[slot];
        if (currentBid.bidAmount == 0 || slotForeclosed(slot)) {
            return 0;
        } else if (block.timestamp == currentBid.periodStart) {
            return currentBid.bidAmount;
        } else {
            return uint128(uint256(currentBid.bidAmount) - (uint256(currentBid.bidAmount) * (block.timestamp - currentBid.periodStart) * currentBid.taxNumerator / (uint256(currentBid.taxDenominator) * 86400)));
        }
    }

    function slotForeclosed(uint8 slot) public view returns (bool) {
        if(slotExpiration[slot] <= block.timestamp) {
            return true;
        }
        return false;
    }

    function stake(uint128 amount) external nonReentrant {
        _stake(amount);
    }

    function stakeWithPermit(
        uint128 amount, 
        uint256 deadline, 
        uint8 v, 
        bytes32 r, 
        bytes32 s
    ) external nonReentrant {
        token.permit(msg.sender, address(this), amount, deadline, v, r, s);
        _stake(amount);
    }

    function unstake(uint128 amount) external nonReentrant {
        require(stakedBalance[msg.sender] >= amount, "amount > unlocked balance");
        stakedBalance[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
        emit Unstake(msg.sender, amount);
    }

    function setSlotDelegate(uint8 slot, address delegate) external onlySlotOwner(slot) {
        require(delegate != address(0), "cannot delegate to 0 address");
        emit SlotDelegateUpdated(slot, msg.sender, delegate, slotDelegate(slot));
        _slotDelegate[slot] = delegate;
    }

    function setTaxRate(uint16 numerator, uint16 denominator) external onlyAdmin {
        require(denominator > numerator, "denominator must be > numerator");
        emit TaxRateUpdated(numerator, denominator, taxNumerator, taxDenominator);
        taxNumerator = numerator;
        taxDenominator = denominator;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        emit AdminUpdated(newAdmin, admin);
        admin = newAdmin;
    }

    function _claimSlot(uint8 slot, uint128 bid, address delegate) internal {
        require(delegate != address(0), "cannot delegate to 0 address");
        Bid storage currentBid = slotBid[slot];
        uint128 existingBidAmount = currentBid.bidAmount;
        uint128 existingSlotBalance = slotBalance(slot);
        uint128 taxedBalance = existingBidAmount - existingSlotBalance;
        require((existingSlotBalance == 0 && bid >= MIN_BID) || bid >= existingBidAmount * 110 / 100, "bid too small");

        uint128 bidderStakedBalance = stakedBalance[msg.sender];
        uint128 bidIncrement = currentBid.bidder == msg.sender ? bid - existingSlotBalance : bid;
        if (bidderStakedBalance > 0) {
            if (bidderStakedBalance >= bidIncrement) {
                stakedBalance[msg.sender] -= bidIncrement;
            } else {
                stakedBalance[msg.sender] = 0;
                token.transferFrom(msg.sender, address(this), bidIncrement - bidderStakedBalance);
            }
        } else {
            token.transferFrom(msg.sender, address(this), bidIncrement);
        }

        if (currentBid.bidder != msg.sender) {
            stakedBalance[currentBid.bidder] += existingSlotBalance;
        }
        
        if (taxedBalance > 0) {
            token.burn(taxedBalance);
        }

        _slotOwner[slot] = msg.sender;
        _slotDelegate[slot] = delegate;

        currentBid.bidder = msg.sender;
        currentBid.periodStart = uint64(block.timestamp);
        currentBid.bidAmount = bid;
        currentBid.taxNumerator = taxNumerator;
        currentBid.taxDenominator = taxDenominator;

        slotExpiration[slot] = uint64(block.timestamp + uint256(taxDenominator) * 86400 / uint256(taxNumerator));

        emit SlotClaimed(slot, msg.sender, delegate, bid, existingBidAmount, taxNumerator, taxDenominator);
    }

    function _stake(uint128 amount) internal {
        token.transferFrom(msg.sender, address(this), amount);
        stakedBalance[msg.sender] += amount;
        emit Stake(msg.sender, amount);
    }

}