'use strict';

var Web3PromiEvent = require('web3-core-promievent');
var utils = require('./utils');
var units = require('./units');
var Web3 = require('web3');

const NETWORK_ETH = 'eth';
const NETWORK_WAN = 'wan';

// invalid: transaction data is invalid
const STATE_INVALID = 'invalid';
// pending: transaction being constructed
const STATE_PENDING = 'pending';
// ready: transaction details complete
const STATE_READY = 'ready';

/**
 * constructor function for the Transaction class
 * client only needs to be provided if transaction
 * data must be completed from the client node
 * 
 * we don't need to return a promise from the constructor,
 * but each setter must return a promise.
 * 
 * @param {*} client
 * @param {*} transaction
 */
function Transaction(client, transaction) {
    var self = this;

    self.promiEvent = Web3PromiEvent();

    self.state = STATE_PENDING;
    self.invalidProperties = [];

    self.setClient(client);

    transaction = transaction || {};

    // default to ethereum network
    transaction.network = transaction.network || NETWORK_ETH;

    self.setNetwork(transaction.network);
    self.setChainId(transaction.chainId);

    self.setReceiverAddress(transaction.to);
    self.setSenderAddress(transaction.from);

    self.setNonce(transaction.nonce);

    // TODO check denomination and network
    self.setValue(transaction.value, transaction.denomination);

    self.setData(transaction.data);

    // NOTE order is important, gas price and limit
    //      should be the last details set
    self.setGasPrice(transaction.gasPrice);
    self.setGasLimit(transaction.gasLimit);
}

/**
 * return an unprocessed transaction object with
 * this transaction instance's values
 */
Transaction.prototype.getRawTransaction = function(){
    var self = this;

    return {
        to: self.to,
        from: self.from,
        value: self.value,
        chainId: self.chainId,
        nonce: self.nonce,
        gasPrice: self.gasPrice,
        gasLimit: self.gasLimit,
        data: self.data
    };
};

/**
 * returns the signed transport object
 */
Transaction.prototype.getSignedTransaction = function(privateKey){
    var self = this;

    if (self.state === STATE_READY){
        try {
            //console.log('signing for ' + self.network + ' network');
            //console.log(self.getTransportTransaction());
            var signedTransaction = utils[self.network].signRawTransaction(
                self.getTransportTransaction(),
                privateKey
            );
            //console.log('signed => ' + JSON.stringify(signedTransaction));
            return '0x' + signedTransaction.toString('hex');
        } catch (exception){
            //console.log(exception);
            throw new Error('cannot sign transaction for unsupported network');
        }
    }

    throw new Error('cannot sign incomplete transaction');
};

/**
 * return transaction object ready for transport
 */
Transaction.prototype.getTransportTransaction = function(){
    var self = this;

    var rawObject = self.getRawTransaction();
    var transportObject = {};

    try{
        for (var property in rawObject){
            switch (property){
                case "value":
                case "gasPrice":
                case "gasLimit":
                case "nonce":
                    if (!Web3.utils.isHex(rawObject[property])){
                        console.log('marshalling ' + property + ' to Hex');
                        transportObject[property] = Web3.utils.toHex(rawObject[property]);
                        console.log('marshalled ' + property + ' to Hex');
                    } else {
                        transportObject[property] = rawObject[property];
                    }
                    break;
                default:
                    transportObject[property] = rawObject[property];
            }
        }
    } catch (error){
        throw new Error('invalid transport object');
    }

    return transportObject;
};

/**
 * set a transaction field status to invalid and report to
 * caller
 */
Transaction.prototype.invalidate = function(property, msg){
    var self = this;

    self.state = STATE_INVALID;
    self.invalidProperties.push(property);

    // if promiEvent hasn't yet been resolved
    if (self.promiEvent){
        self.promiEvent.eventEmitter.emit('invalid', property, msg);
        self.promiEvent.reject(new Error('invalid ' + property + ': ' + msg));
    } else {
        throw new Error(msg);
    }
}

/**
 * reset property value to null and
 * remove from invalidProperties list
 */
Transaction.prototype.resetProperty = function(property){
    var self = this;
    self[property] = null;
    var invalidProperties = [];
    
    // transfer all invalid properties to new array
    // except for the one provided
    for (var i in self.invalidProperties){
        if (self.invalidProperties[i] != property) {
            invalidProperties.push(property);
        }
    }

    self.invalidProperties = invalidProperties;
    if (invalidProperties.length == 0){
        self.state = STATE_PENDING;
    }
};

/**
 * if chainId isn't submitted then it must be determined
 * from the client node
 */
Transaction.prototype.setChainId = function(chainId){
    var self = this;
    self.resetProperty('chainId');

    if (chainId){
        self.chainId = chainId;
        self.updateState('setChainId');
    } else {
        if (!self.client){
            return self.invalidate('chainId', 'cannot set chainId with no client available');
        }
        // get chainId from client
        self.client.eth.net.getId()
            .then(function(chainId){
                self.chainId = chainId;
                self.updateState('setChainId');
            })
            .catch(function(error){
                self.invalidate('chainId', error.message);
            });
    }
};

/**
 * set sdk client
 */
Transaction.prototype.setClient = function(client){
    this.client = client;
};

// TODO contract and abi

Transaction.prototype.setData = function(data){
    var self = this;
    self.data = data || "";
    self.updateState('setData');
}

/**
 * gas / gas limit, defined per number of operations required
 * generally 21000 for standard transactions, 200000 during an ICO
 * (note: upper bound from MCC was 800000, but when signing a
 * wanchain transaction it was hard-coded to 47000)
 */
Transaction.prototype.setGasLimit = function(gasLimit){
    var self = this;
    self.resetProperty('gasLimit');

    if (gasLimit){
        self.gasLimit = gasLimit;
        self.updateState('setGasLimit');
    } else {
        // TODO override for WAN network with hardcoded values

        // NOTE if gasPrice not set and limit not overridden,
        //      we cannot estimate the limit. once gasPrice is
        //      set it must ensure the limit is set too
        if (!self.gasPrice){
            return;
        }

        if (!self.client){
            return self.invalidate('gasLimit', 'cannot set gasLimit with no client available');
        }

        self.client.eth.estimateGas(self.getTransportTransaction())
            .then(function(gasLimit){
                self.gasLimit = gasLimit;
                self.updateState('setGasLimit');
            })
            .catch(function(error){
                self.invalidate('gasLimit', error.message);
            });
    }
}

/**
 * gas price per gas, measured in gwei
 * 
 * recommended:
 *  fast (40 GWEI) - next block
 *  average (4 GWEI) - next few blocks
 *  slow (.6 GWEI) - within several minutes
 * 
 * NOTE: in MCC, when signing a wanchain transaction
 *       it was hard-coded to 200000000000
 * 
 * NOTE: it might be better to retrieve the price from https://ethgasstation.info/
 *       see https://github.com/ethereum/go-ethereum/issues/15825#issuecomment-355872594
 */
Transaction.prototype.setGasPrice = function(gasPrice){
    var self = this;
    self.resetProperty('gasPrice');

    if (gasPrice){
        self.gasPrice = gasPrice;
        self.updateState('setGasPrice');
    } else {
        // TODO override for WAN network with hardcoded values
        if (!self.client){
            return self.invalidate('gasPrice', 'cannot set gasPrice with no client available');
        }
        self.client.eth.getGasPrice()
            .then(function(gasPrice){
                // gas price returned in gwei, which requires * 1e9 to convert to wei
                self.gasPrice = gasPrice * 1e9;
                // ensure gas limit is set (which will call updateState)
                self.setGasLimit(self.gasLimit);
            })
            .catch(function(error){
                self.invalidate('gasPrice', error.message);
            });
    }
}

Transaction.prototype.setNetwork = function(network){
    var self = this;
    self.resetProperty('network');

    switch (network){
        case NETWORK_ETH:
        case NETWORK_WAN:
            /*if (network != self.network) {
                // TODO recalculate any values that might change
                // NOTE: value will always be stored in wei, no need to recalculate
            }*/
            self.network = network;
            self.updateState('setNetwork');
            break;
        default:
            self.invalidate('chainId', 'invalid network specified');
    }
};

/**
 * wrapper for setChainId
 */
Transaction.prototype.setNetworkId = function(networkId){
    this.setChainId(networkId);
};

Transaction.prototype.setNonce = function(nonce){
    var self = this;
    self.resetProperty('nonce');

    if (nonce){
        self.nonce = nonce;
        self.updateState('setNonce');
    } else {
        if (!self.client){
            return self.invalidate('nonce', 'cannot set nonce with no client available');
        }

        // NOTE if sender address not set we cannot get the
        //      transaction count. once sender address is
        //      set it must ensure the nonce is set too
        if (!self.from){
            return;
        }

        // get nonce from client
        self.client.eth.getTransactionCount(self.from)
            .then(function(result){
                self.nonce = result;
                self.updateState('setNonce');
            })
            .catch(function(error){
                self.invalidate('nonce', error.message);
            });
    }
};

Transaction.prototype.setReceiverAddress = function(address){
    var self = this;
    self.resetProperty('to');
    
    if (!utils[self.network].isValidAddress){
        return self.invalidate('to', 'invalid receiver address');
    }

    self.to = address;
    self.updateState('setReceiverAddress');
};

Transaction.prototype.setSenderAddress = function(address){
    var self = this;
    self.resetProperty('from');
    
    if (!utils[self.network].isValidAddress){
        return self.invalidate('from', 'invalid sender address');
    }

    self.from = address;
    // ensure nonce is set (which will call updateState)
    self.setNonce(self.nonce);
};

/**
 * we need to store the value using ethereum denominations (because
 * web3.js is for ethereum), so regardless of what is sent we must
 * store the value in wei.
 */
Transaction.prototype.setValue = function(value, denomination){
    var self = this;
    self.resetProperty('value');

    if (denomination){
        // convert the denomination from the current network denominations
        // to ethereum
        denomination = units.convert(denomination, self.network);
    } else {
        // denomination defaults to smallest ethereum unit
        denomination = 'wei';
    }

    // see https://web3js.readthedocs.io/en/1.0/web3-utils.html#towei
    self.value = Web3.utils.toWei(value, denomination);
    self.updateState('setValue');
};

Transaction.prototype.updateState = function(caller){
    //console.log('updateState called from ' + caller);
    var self = this;

    if (self.invalidProperties.length > 0){
        self.state = STATE_INVALID;
        return;
    }

    // ensure all transaction details have been set,
    // 0 is a valid value so check against null
    if (self.to != null &&
        self.from != null &&
        self.value != null &&
        self.chainId != null &&
        self.nonce != null &&
        self.gasPrice != null &&
        self.gasLimit != null &&
        self.data != null
    ) {
        try {
            self.state = STATE_READY;

            if (self.promiEvent){
                // resolve promise with this transaction instance
                self.promiEvent.resolve(self);
                // remove promiEvent so that it can only
                // resolve once
                self.promiEvent = null;
            }
        } catch (error){
            self.state = STATE_INVALID;
            
            if (self.promiEvent){
                self.promiEvent.eventEmitter.emit('error', error);
                self.promiEvent.reject(error);
            } else {
                throw error;
            }
        }
    } else {
        // no need to do anything when transaction isn't ready
        //console.log(self.getRawTransaction());
    }
};

/**
 * creates a transaction instance and returns its promiEvent,
 * which will resolve when transaction is ready and fire error
 * events whenever there are issues
 * @param {*} client 
 * @param {*} transaction 
 */
var createTransaction = function(client, transaction){
    var transaction = new Transaction(client, transaction);
    return transaction.promiEvent.eventEmitter;
};

var exportObject = {
    createTransaction: createTransaction,
    NETWORK_ETH: NETWORK_ETH,
    NETWORK_WAN: NETWORK_WAN,
    Transaction: Transaction
};

try {
    module.exports = exportObject;
} catch (exception){
    console.log('node.js Transaction export error: ' + exception.message);
}