'use strict';

var Web3 = require('web3');
var Web3PromiEvent = require('web3-core-promievent');
var transactions = require('./transactions');
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

    self.blockchainNetwork = "eth";

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
 * specify host's blockchain network, can be set in the
 * transaction object as well
 */
Client.prototype.setBlockchainNetwork = function(network){
    var self = this;

    // default to eth network
    network = network || transactions.NETWORK_ETH;
    switch (network.toLowerCase()){
        case 'eth':
        case 'ethereum': // not recommended, but fine
            self.blockchainNetwork = transactions.NETWORK_ETH;
            break;
        case 'wan':
        case 'wanchain': // not recommended, but fine
            self.blockchainNetwork = transactions.NETWORK_WAN;
            break;
        default:
            throw new Error("invalid network");
    }
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
  * error wrapping to provide more details where possible
  * @param {Client} client 
  * @param {Transaction} transaction 
  * @param {*} promiEvent 
  * @param {Error} error 
  * @param {string} action 'emit' or 'reject', if null method will return the processed error 
  */
var transactionErrorWrapper = function(client, transaction, promiEvent, error, action){
    if (!action){
        throw new Error('invalid errorWrapper for error: ' + error.message);
    }

    // add clarification for insufficient funds error
    if (error.message.indexOf('insufficient funds for gas * price + value') >= 0){
        transaction.checkSufficientFunds()
            .then(function(hasSufficientFunds){
                if (hasSufficientFunds){
                    error.message =
                        'insufficient funds reported but funds appear sufficient, possibly a signing error';
                } else {
                    error.message =
                        'insufficient funds for gas * price + value (' +
                        transaction.gasLimit + ' * ' +
                        transaction.gasPrice + ' + ' +
                        transaction.value + ')'
                    ;
                }

                switch (action){
                    case 'emit':
                        promiEvent.eventEmitter.emit('error', error);
                        break;
                    case 'reject':
                        promiEvent.reject(error);
                        break;
                }                
            });
    } else {
        switch (action){
            case 'emit':
                promiEvent.eventEmitter.emit('error', error);
                break;
            case 'reject':
                promiEvent.reject(error);
                break;
        }    
    }
};

var sendUnsignedTransaction = function(client, transaction, promiEvent){
    client.eth.sendTransaction(transaction.getTransportTransaction())
        .on('transactionHash', function(hash){
            promiEvent.eventEmitter.emit('transactionHash', hash);
        })
        .on('receipt', function(receipt){
            promiEvent.eventEmitter.emit('receipt', receipt);
        })
        .on('confirmation', function(confirmationNumber, receipt){
            promiEvent.eventEmitter.emit('confirmation', confirmationNumber, receipt);
        })
        .on('error', function(error){
            transactionErrorWrapper(client, transaction, promiEvent, error, 'emit');
        })
        .then(function(result){
            promiEvent.resolve(result);
        })
        .catch(function(error){
            transactionErrorWrapper(client, transaction, promiEvent, error, 'reject');
        })
        ;
};

var sendSignedTransaction = function(client, transaction, promiEvent, privateKey){
    
    try {
        var signedTransaction = transaction.signTransaction(privateKey);
        client.eth.sendSignedTransaction(signedTransaction)
            .on('transactionHash', function(hash){
                promiEvent.eventEmitter.emit('transactionHash', hash);
            })
            .on('receipt', function(receipt){
                promiEvent.eventEmitter.emit('receipt', receipt);
            })
            .on('confirmation', function(confirmationNumber, receipt){
                promiEvent.eventEmitter.emit('confirmation', confirmationNumber, receipt);
            })
            .on('error', function(error){
                transactionErrorWrapper(client, transaction, promiEvent, error, 'emit');
            })
            .then(function(result){
                promiEvent.resolve(result);
            })
            .catch(function(error){
                transactionErrorWrapper(client, transaction, promiEvent, error, 'reject');
            })
            ;    
    } catch (error) {
        promiEvent.reject(error);
    }
};

/**
 * returns an sdk transaction object
 */
Client.prototype.createTransaction = function (transaction){
    var self = this;

    // we need to use promiEvents to wrap promiEvents
    var promiEvent = Web3PromiEvent();

    // network can be specified using the setBlockchainNetwork method or
    // in the transaction object
    if (transaction.network){
        try {
            self.setBlockchainNetwork(transaction.network);   
        } catch (error){
            promiEvent.reject(error);
            return promiEvent.eventEmitter;
        }
    } else {
        transaction.network = self.blockchainNetwork;
    }

    transactions.createTransaction(self, transaction)
        .on('message', function(msg) {
            promiEvent.eventEmitter.emit('message', msg);
        })
        .on('invalid', function(property, msg){
            promiEvent.eventEmitter.emit('invalid', property, msg);
        })
        .on('error', function(error){
            promiEvent.eventEmitter.emit('error', error);
        })
        .then(promiEvent.resolve)
        .catch(function(error){
            promiEvent.reject(error);
        })
        ;

    return promiEvent.eventEmitter;
};

/**
 * entrypoint for sending signed or unsigned transactions on all supported networks
 * transaction denomination defaults to smallest unit (eg. Wei or Win)
 */
Client.prototype.sendTransaction = function (transaction, privateKey) {
    var self = this;

    // we need to use promiEvents to wrap promiEvents
    var promiEvent = Web3PromiEvent();

    // network can be specified using the setBlockchainNetwork method or
    // in the transaction object
    if (transaction.network){
        try {
            self.setBlockchainNetwork(transaction.network);   
        } catch (error){
            promiEvent.reject(error);
            return promiEvent.eventEmitter;
        }
    } else {
        transaction.network = self.blockchainNetwork;
    }

    // if it's already an SDK transaction
    if (transaction.generator === "cryptocurve-sdk"){
        process.nextTick(()=>{
            promiEvent.eventEmitter.emit('message', 'validating existing transaction object');
        });
        transaction.validate()
            .on('message', function(msg) {
                promiEvent.eventEmitter.emit('message', msg);
            })
            .on('invalid', function(property, msg){
                promiEvent.eventEmitter.emit('invalid', property, msg);
            })
            .then(function(){
                if (privateKey){
                    sendSignedTransaction(self, transaction, promiEvent, privateKey);
                } else {
                    sendUnsignedTransaction(self, transaction, promiEvent);
                }    
            })
            .catch(function(error){
                promiEvent.reject(error);
            });
    } else {
        // create SDK transaction object
        process.nextTick(()=>{
            promiEvent.eventEmitter.emit('message', 'generating new transaction object');
        });
        transactions.createTransaction(self, transaction)
            .on('message', function(msg) {
                promiEvent.eventEmitter.emit('message', msg);
            })
            .on('invalid', function(property, msg){
                promiEvent.eventEmitter.emit('invalid', property, msg);
            })
            .on('error', function(error){
                promiEvent.eventEmitter.emit('error', error);
            })
            .then(function(transaction){
                if (privateKey){
                    sendSignedTransaction(self, transaction, promiEvent, privateKey);
                } else {
                    sendUnsignedTransaction(self, transaction, promiEvent);
                }
            })
            .catch(function(error){
                promiEvent.reject(error);
            })
            ;
    }

    return promiEvent.eventEmitter;
};

try {
    module.exports = Client;
} catch (exception){
    console.log('node.js Client export error: ' + exception.message);
}
  