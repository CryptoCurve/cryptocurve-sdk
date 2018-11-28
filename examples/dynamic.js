'use strict';

// when installed via npm simple use require('cryptocurve-sdk')
var CryptoCurveSDK = require('../bin/cryptocurve-sdk');

var samples = require('./samples');
var testAccounts = require('./testAccounts');

var runQueue = [];

var runNextQueuedSample = function(){
    var sampleName;
    if (sampleName = runQueue.shift()){
        if (sampleName){
            try {
                console.log('---------------');
                console.log('\n' + sampleName + ':');
                console.log('---------------\n');
                eval(samples[sampleName].code);
            } catch (exception){
                handleException(exception);
            }
        }
    }
};

function setResult(text, id){
    text = text || '';
    if (id){
        text = id + ': ' + text;
    }
    id = id || 'result';
    console.log(text);
}

function setFinalResult(text, id){
    setResult(text, id);
    runNextQueuedSample();
}

function handleException(exception){
    console.error(exception);
    runNextQueuedSample();
}

var blockchainNetwork, lastTransactionHash;

switch (process.argv[2]){
    case 'list':
        for (var name in samples){
            if (name != "Try your own code"){
                console.log('"' + name + '"');
            }
        }
        break;
    case 'run':
        if (process.argv.length > 3) {
            var sdk = new CryptoCurveSDK.Client();
            var sdkUtils = CryptoCurveSDK.utils;
            // get blockchain network from parameters
            blockchainNetwork = process.argv[4];
            if (!blockchainNetwork || blockchainNetwork.length == 0){
                blockchainNetwork = 'eth';
            }
            // get host from parameters
            var nodeHost = process.argv[5];
            // username and password will be set to 'test' by default if not passed
            var username = 'test', password = 'test';

            sdk.setProvider(nodeHost, 0, username, password);
    
            for (var name in samples){
                if (name != "Try your own code" &&
                    (process.argv[3] == "all" || process.argv[3] == name)
                ) {
                        runQueue.push(name);
                }
            }
            runNextQueuedSample();
            break;
        }
    default:
        console.log('usage: ');
        console.log('list sample names: node dynamic.js list');
        console.log('run sample:        node dynamic.js run <sample name> [blockchain network] [host node]');
        console.log('run all samples:   node dynamic.js run all [blockchain network] [host node]');
        console.log('host node defaults to localhost, blockchain network can be either "eth" or "wan"');
}
