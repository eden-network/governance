// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IGovernance.sol";
import "./lib/AccessControl.sol";
import "./lib/BytesLib.sol";

contract DistributorGovernance is AccessControl, IGovernance {
    using BytesLib for bytes;

    /// @notice Admin governance role
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");

    /// @notice Admin delegator role
    bytes32 public constant DELEGATOR_ROLE = keccak256("DELEGATOR_ROLE");

    mapping (address => address) public override rewardCollector;
    mapping (address => bool) public override blockProducer;
    bytes private _rewardSchedule;

    uint256 constant REWARD_SCHEDULE_ENTRY_LENGTH = 32;

    modifier onlyGov() {
        require(hasRole(GOV_ROLE, msg.sender), "must be gov");
        _;
    }

    modifier onlyDelegatorOrProducer(address producer) {
        require(hasRole(DELEGATOR_ROLE, msg.sender) || msg.sender == producer, "must be producer of delegator");
        _;
    }

    constructor(
        address _admin, 
        address[] memory _blockProducers,
        address[] memory _collectors
    ) {
        require(_blockProducers.length == _collectors.length, "length mismatch");
        _setupRole(GOV_ROLE, _admin);
        _setupRole(DELEGATOR_ROLE, _admin);
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        for(uint i; i< _blockProducers.length; i++) {
            blockProducer[_blockProducers[i]] = true;
            emit BlockProducerAdded(_blockProducers[i]);

            rewardCollector[_blockProducers[i]] = _collectors[i];
            emit BlockProducerRewardCollectorChanged(_blockProducers[i], _collectors[i]);
        }
    }

    function add(address producer) onlyGov public {
        require(blockProducer[producer] == false, "already block producer");
        blockProducer[producer] = true;
        emit BlockProducerAdded(producer);
    }

    function addBatch(address[] memory producers) external {
        for(uint i; i< producers.length; i++) {
            add(producers[i]);
        }
    }

    function remove(address producer) onlyGov public {
        require(blockProducer[producer] == true, "not block producer");
        blockProducer[producer] = false;
        emit BlockProducerRemoved(producer);
    }

    function removeBatch(address[] memory producers) external {
        for(uint i; i< producers.length; i++) {
            remove(producers[i]);
        }
    }

    function delegate(address producer, address collector) onlyDelegatorOrProducer(producer) public {
        rewardCollector[producer] = collector;
        emit BlockProducerRewardCollectorChanged(producer, collector);
    }

    function delegateBatch(address[] memory producers, address[] memory collectors) external {
        require(producers.length == collectors.length, "length mismatch");
        for(uint i; i< producers.length; i++) {
            delegate(producers[i], collectors[i]);
        }
    }

    function setRewardSchedule(bytes memory set) onlyGov public {
        _rewardSchedule = set;
        emit RewardScheduleChanged();
    }

    function rewardScheduleEntry(uint256 index) public override view returns (RewardScheduleEntry memory) {
        RewardScheduleEntry memory entry;
        uint256 start = index * REWARD_SCHEDULE_ENTRY_LENGTH;
        entry.startTime = _rewardSchedule.toUint64(start);
        entry.epochDuration = _rewardSchedule.toUint64(start + 8);
        entry.rewardsPerEpoch = _rewardSchedule.toUint128(start + 16);
        return entry;
    }

    function rewardScheduleEntries() public override view returns (uint256) {
        return _rewardSchedule.length / REWARD_SCHEDULE_ENTRY_LENGTH;
    }
}
