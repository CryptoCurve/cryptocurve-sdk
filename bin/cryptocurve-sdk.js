'use strict';
var Web3 = require('web3');
var ethUtil = require('ethereumjs-util');
var Signatures = require('./signatures');
var units = require('./lib/units');
var DEFAULT_HOST = 'http://localhost:8545';
/**
 * constructor function for the CryptoCurveSDK class
 * @param {*} host
 * @param {*} timeout
 * @param {*} username
 * @param {*} password
 */
function CryptoCurveSDK(host, timeout, username, password) {
    var self = this;
    var web3 = new Web3();
    // make web3 and its methods directly accessible
    self.web3 = web3;
    for (var obj in self.web3) {
        self[obj] = self.web3[obj];
    }
    // add sdk utils to eth.utils
    /*self.utils = self.utils || {};
    for (var obj in sdkUtil){
        if (self.utils[obj]) {
            console.error('WARNING: SDK UTILS overwriting ' + obj + ' from web3 module');
        }
        self.utils[obj] = sdkUtil[obj];
    }*/
    // make signatures library directly accessible
    var signatures = new Signatures();
    self.signatures = signatures;
    // wrap setProvider
    self.setProvider = self.setProviderWrapper;
    // set the provider
    self.setProvider(host, timeout, username, password);
}
/**
 * reset the client node connection details for the underlying objects
 * @param {*} host
 * @param {*} timeout
 * @param {*} username
 * @param {*} password
 */
CryptoCurveSDK.prototype.setProviderWrapper = function (host, timeout, username, password) {
    var self = this;
    if (!host || host.length == 0) {
        host = DEFAULT_HOST;
    }
    timeout = timeout || 0;
    username = username || 'test';
    password = password || 'test';
    self.web3.setProvider(new self.web3.providers.HttpProvider(host, timeout, username, password));
    self.currentProvider = self.web3.currentProvider;
};
/**
 * convert transaction values to the correct format
 */
CryptoCurveSDK.prototype.fixTransactionValues = function (transaction) {
    var self = this;
    // TODO ensure we have gasprice and nonce
    for (var property in transaction) {
        switch (property) {
            case "value":
                var denomination = transaction.denomination || 'wei';
                denomination = units.convert(denomination, transaction.network, 'eth');
                if (!self.utils.isHex(transaction.value)) {
                    if (!self.utils.isBN(transaction.value)) {
                        // see https://web3js.readthedocs.io/en/1.0/web3-utils.html#towei
                        transaction.value = self.utils.toWei(transaction.value, denomination);
                    }
                    transaction.value = self.utils.toHex(transaction.value);
                }
                break;
            case "gas":
            case "gasLimit":
            case "gasPrice":
            case "nonce":
                if (!self.utils.isHex(transaction[property])) {
                    transaction[property] = self.utils.toHex(transaction[property]);
                }
                break;
                break;
        }
    }
    // ensure we have data
    transaction.data = transaction.data || "";
    return transaction;
};
/**
 * send signed or unsigned transaction on ethereum network
 */
CryptoCurveSDK.prototype.sendEthTransaction = function (transaction, privateKey) {
    var self = this;
    transaction = self.fixTransactionValues(transaction);
    if (privateKey) {
        var signedTransaction = self.signatures.eth.signRawTransaction(transaction, privateKey);
        return self.eth.sendSignedTransaction('0x' + signedTransaction.toString('hex'));
    }
    return self.eth.sendTransaction(transaction);
};
/**
 * send signed or unsigned transaction on wanchain network
 */
CryptoCurveSDK.prototype.sendWanTransaction = function (transaction, privateKey) {
    var self = this;
    // TODO: currently just passing through to maintain compatibility with
    //      previous users, must be fixed soon
    // force wan gas values
    /*transaction.gasPrice = 200000000000;
    transaction.gasLimit = 47000;

    transaction = self.fixTransactionValues(transaction);*/
    if (privateKey) {
        var signedTransaction = self.signatures.wan.signRawTransaction(transaction, privateKey);
        return self.eth.sendSignedTransaction('0x' + signedTransaction.toString('hex'));
    }
    return self.eth.sendTransaction(transaction);
};
/**
 * entrypoint for sending signed or unsigned transactions on all supported networks
 * transaction denomination defaults to smallest unit (eg. Wei or Win)
 */
CryptoCurveSDK.prototype.sendTransaction = function (transaction, privateKey) {
    var self = this;
    // ensure that privateKey is a Buffer if it's been sent
    if (privateKey && !Buffer.isBuffer(privateKey)) {
        privateKey = ethUtil.toBuffer(ethUtil.addHexPrefix(privateKey));
    }
    switch (transaction.network.toLowerCase()) {
        case 'eth':
        case 'ethereum':
            transaction.network = 'eth';
            return self.sendEthTransaction(transaction, privateKey);
            break;
        case 'wan':
        case 'wanchain':
            transaction.network = 'wan';
            return self.sendWanTransaction(transaction, privateKey);
            break;
        default:
            throw new Error('invalid network');
    }
};
// enable use in both node.js and browser contexts
// node.js
try {
    module.exports = CryptoCurveSDK;
}
catch (exception) {
    console.log('node.js error: ' + exception.message);
}
// browser
try {
    // initialize cryptocurve object if necessary
    window.cryptocurve = window.cryptocurve || {};
    window.cryptocurve.sdk = CryptoCurveSDK;
}
catch (exception) {
    console.log('web browser error: ' + exception.message);
}
//# sourceMappingURL=cryptocurve-sdk.js.map