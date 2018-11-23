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
        // check balance to see if funds are really insufficient, or if this
        // could possibly be a signing issue
        var gasLimit = Web3.utils.toBN(transaction.gasLimit);
        var gasPrice = Web3.utils.toBN(transaction.gasPrice);
        var value = Web3.utils.toBN(transaction.value);
        var cost = (gasLimit.mul(gasPrice)).add(value);

        client.eth.getBalance(transaction.from)
            .then(function(balance){
                balance = Web3.utils.toBN(balance);
                if (balance.gte(cost)){
                    error.message =
                        'insufficient funds reported but funds appear sufficient, possibly a signing error';;
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
    
    /*client.eth.accounts.signTransaction(transaction.getTransportTransaction(), privateKey)
        .then(function(signedTransaction){
        });*/

    try {
        var signedTransaction = transaction.getSignedTransaction(privateKey);
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
 * entrypoint for sending signed or unsigned transactions on all supported networks
 * transaction denomination defaults to smallest unit (eg. Wei or Win)
 */
Client.prototype.sendTransaction = function (transaction, privateKey) {
    var self = this;

    // we need to use promiEvents to wrap promiEvents
    var promiEvent = Web3PromiEvent();

    // default to eth network
    transaction.network = transaction.network || transactions.NETWORK_ETH;
    switch (transaction.network.toLowerCase()){
        case 'eth':
        case 'ethereum': // not recommended, but fine
            transaction.network = transactions.NETWORK_ETH;
            break;
        case 'wan':
        case 'wanchain': // not recommended, but fine
            transaction.network = transactions.NETWORK_WAN;
            break;
        default:
            promiEvent.reject(new Error('invalid network'));
            return promiEvent.eventEmitter;
    }

    transactions.createTransaction(self, transaction)
        .on('invalid', function(property, msg){
            promiEvent.eventEmitter.emit('error', msg);
        })
        .on('error', function(error){
            promiEvent.eventEmitter.emit('error', error);
        })
        .then(function(transaction){
            var sendTransaction = self.eth.sendTransaction;
            var transportTransaction = transaction.getTransportTransaction();

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

        return promiEvent.eventEmitter;
};

try {
    module.exports = Client;
} catch (exception){
    console.log('node.js Client export error: ' + exception.message);
}
  