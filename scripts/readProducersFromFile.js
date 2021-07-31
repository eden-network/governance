const fs = require('fs')
const { network } = require("hardhat");

function readProducersFromFile() {
    const file = fs.readFileSync(`./init/producers/${network.name}.json`, 'utf-8')
    return JSON.parse(file)
}

module.exports.readProducersFromFile = readProducersFromFile
