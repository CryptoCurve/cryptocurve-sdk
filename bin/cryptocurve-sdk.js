'use strict';
//var sdkUtil = require('./cryptocurve-sdk-util');
var Web3 = require('web3');
var ethUtil = require('ethereumjs-util');
var Signatures = require('./signatures');
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
 * wrapper for eth.sendTransaction
 */
CryptoCurveSDK.prototype.sendEthTransaction = function (transaction) {
    var self = this;
    // TODO validate all values
    // ensure value in correct hex format
    if (!self.utils.isHex(transaction.value)) {
        if (!self.utils.isBN(transaction.value)) {
            // see https://web3js.readthedocs.io/en/1.0/web3-utils.html#towei
            transaction.value = self.utils.toWei(transaction.value, transaction.denomination);
        }
        transaction.value = self.utils.toHex(transaction.value);
    }
    return self.eth.sendTransaction(transaction);
};
/**
 * entrypoint for sendTransaction for both eth and wan
 */
CryptoCurveSDK.prototype.sendTransaction = function (transaction) {
    var self = this;
    switch (transaction.network.toLowerCase()) {
        case 'eth':
        case 'ethereum':
            return self.sendEthTransaction(transaction);
            break;
        case 'wan':
        case 'wanchain':
            return self.eth.sendTransaction(transaction);
            break;
    }
};
/**
 * entrypoint for sendSignedTransaction for both eth and wan
 */
CryptoCurveSDK.prototype.sendSignedTransaction = function (transaction, privateKey) {
    var self = this;
    var signedTransaction;
    // ensure that privateKey is a Buffer
    if (!Buffer.isBuffer(privateKey)) {
        privateKey = ethUtil.toBuffer(ethUtil.addHexPrefix(privateKey));
    }
    // TODO determine gas, generate nonce
    switch (transaction.network.toLowerCase()) {
        case 'eth':
        case 'ethereum':
            signedTransaction = self.signatures.eth.signRawTransaction(transaction, privateKey);
            break;
        case 'wan':
        case 'wanchain':
            signedTransaction = self.signatures.wan.signRawTransaction(transaction, privateKey);
            break;
        default:
            throw new Error('invalid network');
    }
    return self.eth.sendSignedTransaction('0x' + signedTransaction.toString('hex'));
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