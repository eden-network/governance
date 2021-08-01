const { BigNumber, ethers } = require("ethers");
const EMISSION_SCHEDULE = require("./emissionSchedule");

function makeRewardSchedule(startTime, scaleFactor = 1.0) {
    let time = startTime;
    return EMISSION_SCHEDULE.map(entry => {
        const ret = {
            startTime: time.toString(),
            epochDuration: Math.floor(entry.epochDuration * scaleFactor).toString(),
            rewardsPerEpoch: Math.floor(entry.rewardsPerEpoch * scaleFactor).toString()
        };
        time += Math.floor(entry.entryDuration * scaleFactor);
        return ret;
    });
}

function rewardScheduleEncoder(rewardSchedule) {
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

module.exports = { makeRewardSchedule, rewardScheduleEncoder };
