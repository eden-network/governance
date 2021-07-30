const { BigNumber, ethers } = require("ethers");

export default function rewardScheduleEncoder(rewardSchedule) {
    return ethers.utils.arrayify('0x' + 
        rewardSchedule.map(entry => [
            ethers.utils.defaultAbiCoder.encode(["uint64"], [BigNumber.from(entry.startTime)]).slice(-16),
            ethers.utils.defaultAbiCoder.encode(["uint64"], [BigNumber.from(entry.epochDuration)]).slice(-16),
            ethers.utils.defaultAbiCoder.encode(["uint128"], [ethers.utils.parseEther(entry.rewardsPerEpoch)]).slice(-32)
        ])
        .flat(2)
        .reduce((acc, curr) => acc + curr)
    );
}
