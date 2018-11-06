'use strict';

var Web3 = require('web3');
var utils = require('./utils');
var units = require('./units');

var DEFAULT_HOST = 'http://localhost:8545';

/**
 * constructor function for the Client class
 * @param {*} host 
 * @param {*} timeout 
 * @param {*} username 
 * @param {*} password 
 */
function Client(host, timeout, username, password) {
    var self = this;

    var web3 = new Web3();
    
    // make web3 and its methods directly accessible
    self.web3 = web3;
    for (var obj in self.web3){
        self[obj] = self.web3[obj];
    }
    
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
Client.prototype.setProviderWrapper = function(host, timeout, username, password) {
    var self = this;

    if (!host || host.length == 0){
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
Client.prototype.fixTransactionValues = function(transaction) {
    var self = this;

    // TODO ensure we have gasprice and nonce

    for (var property in transaction){
        switch (property){
            case "value":
                var denomination = transaction.denomination || 'wei';
                denomination = units.convert(denomination, transaction.network, 'eth');

                if (!self.utils.isHex(transaction.value)){
                    if (!self.utils.isBN(transaction.value)){
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
                if (!self.utils.isHex(transaction[property])){
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
Client.prototype.sendEthTransaction = function(transaction, privateKey){
    var self = this;

    transaction = self.fixTransactionValues(transaction);

    if (privateKey){
        var signedTransaction = utils.eth.signRawTransaction(transaction, privateKey);
        return self.eth.sendSignedTransaction(
            '0x' + signedTransaction.toString('hex')
        );
    }
    return self.eth.sendTransaction(transaction);
}

/**
 * send signed or unsigned transaction on wanchain network
 */
Client.prototype.sendWanTransaction = function(transaction, privateKey){
    var self = this;

    // TODO: currently just passing through to maintain compatibility with
    //      previous users, must be fixed soon

    // force wan gas values
    /*transaction.gasPrice = 200000000000;
    transaction.gasLimit = 47000;

    transaction = self.fixTransactionValues(transaction);*/

    if (privateKey){
        var signedTransaction = utils.wan.signRawTransaction(transaction, privateKey); 
        return self.eth.sendSignedTransaction(
            '0x' + signedTransaction.toString('hex')
        );
    }
    return self.eth.sendTransaction(transaction);
}

/**
 * entrypoint for sending signed or unsigned transactions on all supported networks
 * transaction denomination defaults to smallest unit (eg. Wei or Win)
 */
Client.prototype.sendTransaction = function (transaction, privateKey) {
    var self = this;

    // ensure that privateKey is a Buffer if it's been sent
    if (privateKey && !Buffer.isBuffer(privateKey)){
        privateKey = utils.eth.toBuffer(utils.eth.addHexPrefix(privateKey));
    }

    // default to eth network
    transaction.network = transaction.network || 'eth';
    switch (transaction.network.toLowerCase()){
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

try {
    module.exports = Client;
} catch (exception){
    console.log('node.js Client export error: ' + exception.message);
}
  