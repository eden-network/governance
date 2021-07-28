// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IERC20Extended.sol";
import "./interfaces/ILockManager.sol";

/**
 * @title NetworkStake
 * @dev Allows retail stakers to stake and join the Eden Network
 */
contract NetworkStake {
    mapping (address => uint128) public stakedBalance;

    IERC20Extended public token;
    ILockManager public lockManager;
    address public admin;
    uint128 public MIN_STAKE;

    uint256 private _NOT_ENTERED;
    uint256 private _ENTERED;
    uint256 private _status;

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
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
    event MinStakeUpdated(uint128 newMinStake, uint128 oldMinStake);
    event Stake(address indexed claimer, uint256 stakeAmount);
    event Unstake(address indexed staker, uint256 unstakedAmount);

    constructor(
        IERC20Extended _token,
        address _admin,
        address _lockManager
    ) {
        token = _token;
        lockManager = ILockManager(_lockManager);
        admin = _admin;
        emit AdminUpdated(_admin, address(0));

        MIN_STAKE = 100000000000000000000;
        _NOT_ENTERED = 1;
        _ENTERED = 2;
        _status = _NOT_ENTERED;
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
        lockManager.removeVotingPower(msg.sender, address(token), amount);
        stakedBalance[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
        emit Unstake(msg.sender, amount);
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        emit AdminUpdated(newAdmin, admin);
        admin = newAdmin;
    }

    function setMinStake(uint128 newMinStake) external onlyAdmin {
        emit MinStakeUpdated(newMinStake, MIN_STAKE);
        MIN_STAKE = newMinStake;
    }

    function _stake(uint128 amount) internal {
        token.transferFrom(msg.sender, address(this), amount);
        lockManager.grantVotingPower(msg.sender, address(token), amount);
        stakedBalance[msg.sender] += amount;
        emit Stake(msg.sender, amount);
    }

}