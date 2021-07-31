const fs = require('fs')
const { network } = require("hardhat");

function readUpdatersFromFile() {
    const file = fs.readFileSync(`./init/updaters/${network.name}.json`, 'utf-8')
    return JSON.parse(file)
}

module.exports.readUpdatersFromFile = readUpdatersFromFile
