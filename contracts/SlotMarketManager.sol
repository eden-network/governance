// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
  Copyright 2021 Archer DAO: Chris Piatt (chris@archerdao.io).
*/

import "./lib/Initializable.sol";

/**
 * @title SlotMarketManager
 */
contract SlotMarketManager is Initializable {

    /// @notice SlotMarketManager admin
    address public admin;

    /// @notice SlotMarketProxy address
    address public slotMarketProxy;

    /// @notice Admin modifier
    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    /// @notice New admin event
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    /// @notice New slot market proxy event
    event SlotMarketProxyChanged(address indexed oldSlotMarketProxy, address indexed newSlotMarketProxy);

    /**
     * @notice Construct new SlotMarketManager contract, setting msg.sender as admin
     */
    constructor() {
        admin = msg.sender;
        emit AdminChanged(address(0), msg.sender);
    }

    /**
     * @notice Initialize contract
     * @param _slotMarketProxy SlotMarket proxy contract address
     * @param _admin Admin address
     */
    function initialize(
        address _slotMarketProxy,
        address _admin
    ) external initializer onlyAdmin {
        emit AdminChanged(admin, _admin);
        admin = _admin;

        slotMarketProxy = _slotMarketProxy;
        emit SlotMarketProxyChanged(address(0), _slotMarketProxy);
    }

    /**
     * @notice Set new admin for this contract
     * @dev Can only be executed by admin
     * @param newAdmin new admin address
     */
    function setAdmin(
        address newAdmin
    ) external onlyAdmin {
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    /**
     * @notice Set new slot market proxy contract
     * @dev Can only be executed by admin
     * @param newSlotMarketProxy new slot market proxy address
     */
    function setSlotMarketProxy(
        address newSlotMarketProxy
    ) external onlyAdmin {
        emit SlotMarketProxyChanged(slotMarketProxy, newSlotMarketProxy);
        slotMarketProxy = newSlotMarketProxy;
    }

    /**
     * @notice Public getter for SlotMarket Proxy implementation contract address
     */
    function getProxyImplementation() public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("implementation()")) == 0x5c60da1b
        (bool success, bytes memory returndata) = slotMarketProxy.staticcall(hex"5c60da1b");
        require(success);
        return abi.decode(returndata, (address));
    }

    /**
     * @notice Public getter for SlotMarket Proxy admin address
     */
    function getProxyAdmin() public view returns (address) {
        // We need to manually run the static call since the getter cannot be flagged as view
        // bytes4(keccak256("admin()")) == 0xf851a440
        (bool success, bytes memory returndata) = slotMarketProxy.staticcall(hex"f851a440");
        require(success);
        return abi.decode(returndata, (address));
    }

    /**
     * @notice Set new admin for SlotMarket proxy contract
     * @param newAdmin new admin address
     */
    function setProxyAdmin(
        address newAdmin
    ) external onlyAdmin {
        // bytes4(keccak256("changeAdmin(address)")) = 0x8f283970
        (bool success, ) = slotMarketProxy.call(abi.encodeWithSelector(hex"8f283970", newAdmin));
        require(success, "setProxyAdmin failed");
    }

    /**
     * @notice Set new implementation for SlotMarket proxy contract
     * @param newImplementation new implementation address
     */
    function upgrade(
        address newImplementation
    ) external onlyAdmin {
        // bytes4(keccak256("upgradeTo(address)")) = 0x3659cfe6
        (bool success, ) = slotMarketProxy.call(abi.encodeWithSelector(hex"3659cfe6", newImplementation));
        require(success, "upgrade failed");
    }

    /**
     * @notice Set new implementation for SlotMarket proxy contract + call function after
     * @param newImplementation new implementation address
     * @param data Bytes-encoded function to call
     */
    function upgradeAndCall(
        address newImplementation,
        bytes memory data
    ) external payable onlyAdmin {
        // bytes4(keccak256("upgradeToAndCall(address,bytes)")) = 0x4f1ef286
        (bool success, ) = slotMarketProxy.call{value: msg.value}(abi.encodeWithSelector(hex"4f1ef286", newImplementation, data));
        require(success, "upgradeAndCall failed");
    }
}
