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
function Transaction(client, transaction, promiEvent) {
    var self = this;

    self.generator = 'cryptocurve-sdk';

    self.state = STATE_PENDING;
    self.invalidProperties = [];

    self.setClient(client);

    transaction = transaction || {};

    // default to ethereum network
    transaction.network = transaction.network || NETWORK_ETH;

    self.setNetwork(transaction.network, promiEvent);
    self.setChainId(transaction.chainId, promiEvent);

    self.setReceiverAddress(transaction.to, promiEvent);
    self.setSenderAddress(transaction.from, promiEvent);

    self.setNonce(transaction.nonce, promiEvent);

    self.setValue(transaction.value, transaction.denomination, promiEvent);

    self.setData(transaction.data, promiEvent);

    // NOTE order is important, gas price and limit
    //      should be the last details set
    self.setGasPrice(transaction.gasPrice, promiEvent);
    // gas limit must be set via gasPrice unless it's being overridden
    if (transaction.gasLimit) {
        self.setGasLimit(transaction.gasLimit, promiEvent);
    }
}

Transaction.prototype.checkSufficientFunds = function() {
    var self = this;

    var promiEvent = Web3PromiEvent();

    if (self.state != STATE_READY){
        promiEvent.reject(new Error('transaction not ready'));
        return;
    }

    var balance = Web3.utils.toBN(self.balance);

    var gasLimit = Web3.utils.toBN(self.gasLimit);
    var gasPrice = Web3.utils.toBN(self.gasPrice);
    var value = Web3.utils.toBN(self.value);
    
    var cost = (gasLimit.mul(gasPrice)).add(value);

    promiEvent.resolve(balance.gte(cost));
    return promiEvent.eventEmitter;
};

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
                        transportObject[property] = Web3.utils.toHex(rawObject[property]);
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
Transaction.prototype.invalidate = function(property, msg, promiEvent){
    var self = this;
    promiEvent = promiEvent || new Web3PromiEvent();

    self.state = STATE_INVALID;
    self.invalidProperties.push(property);

    promiEvent.eventEmitter.emit('invalid', property, msg);

    return promiEvent.eventEmitter;
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
Transaction.prototype.setChainId = function(chainId, promiEvent){
    var self = this;
    self.resetProperty('chainId');
    promiEvent = promiEvent || new Web3PromiEvent();

    if (chainId){
        self.chainId = chainId;
        self.updateState('setChainId', promiEvent);
    } else {
        if (!self.client){
            return self.invalidate(
                'chainId',
                'cannot set chainId with no client available',
                promiEvent
            );
        }
        // get chainId from client
        self.client.eth.net.getId()
            .then(function(chainId){
                self.chainId = chainId;
                self.updateState('setChainId', promiEvent);
            })
            .catch(function(error){
                self.invalidate('chainId', error.message, promiEvent);
            });
    }

    return promiEvent.eventEmitter;
};

/**
 * set sdk client
 */
Transaction.prototype.setClient = function(client, promiEvent){
    promiEvent = promiEvent || new Web3PromiEvent();
    this.client = client;
    promiEvent.resolve();
    return promiEvent.eventEmitter;
};

// TBD contract and abi

Transaction.prototype.setData = function(data, promiEvent){
    var self = this;
    promiEvent = promiEvent || new Web3PromiEvent();
    self.data = data || "";
    self.updateState('setData', promiEvent);
    return promiEvent.eventEmitter;
}

/**
 * gas / gas limit, defined per number of operations required
 * generally 21000 for standard transactions, 200000 during an ICO
 * (note: upper bound from MCC was 800000, but when signing a
 * wanchain transaction it was hard-coded to 47000)
 */
Transaction.prototype.setGasLimit = function(gasLimit, promiEvent){
    var self = this;
    self.resetProperty('gasLimit');
    promiEvent = promiEvent || new Web3PromiEvent();

    if (gasLimit){
        self.gasLimit = gasLimit;
        self.updateState('setGasLimit', promiEvent);
    } else {
        // TODO override for WAN network with hardcoded values

        // NOTE if gasPrice not set and limit not overridden,
        //      we cannot estimate the limit. once gasPrice is
        //      set it must ensure the limit is set too
        if (!self.gasPrice){
            return self.invalidate('gasLimit', 'cannot estimate gas limit without gas price', promiEvent);
        }

        if (!self.client){
            return self.invalidate('gasLimit', 'cannot set gasLimit with no client available', promiEvent);
        }

        self.client.eth.estimateGas(self.getTransportTransaction())
            .then(function(gasLimit){
                self.gasLimit = gasLimit;
                self.updateState('setGasLimit', promiEvent);
            })
            .catch(function(error){
                self.invalidate('gasLimit', error.message, promiEvent);
            });
    }

    return promiEvent.eventEmitter;
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
Transaction.prototype.setGasPrice = function(gasPrice, promiEvent){
    var self = this;
    self.resetProperty('gasPrice');
    promiEvent = promiEvent || new Web3PromiEvent();

    if (gasPrice){
        self.gasPrice = gasPrice;
        // once gas price has been updated, we must update
        // the gas limit, which is calculated based on the
        // gas price. this will in turn call updateState
        self.setGasLimit(null, promiEvent);
    } else {
        // TODO override for WAN network with hardcoded values
        if (!self.client){
            return self.invalidate(
                'gasPrice',
                'cannot set gasPrice with no client available',
                promiEvent
            );
        }
        self.client.eth.getGasPrice()
            .then(function(gasPrice){
                // gas price returned in gwei, which requires * 1e9 to convert to wei
                self.gasPrice = gasPrice * 1e9;
                // once gas price has been updated, we must update
                // the gas limit, which is calculated based on the
                // gas price. this will in turn call updateState
                self.setGasLimit(null, promiEvent);
            })
            .catch(function(error){
                self.invalidate('gasPrice', error.message, promiEvent);
            });
    }

    return promiEvent.eventEmitter;
}

Transaction.prototype.setNetwork = function(network, promiEvent){
    var self = this;
    self.resetProperty('network');
    promiEvent = promiEvent || new Web3PromiEvent();

    switch (network){
        case NETWORK_ETH:
        case NETWORK_WAN:
            // NOTE: value will always be stored in wei, no need to recalculate
            self.network = network;
            self.updateState('setNetwork', promiEvent);
            break;
        default:
            self.invalidate('chainId', 'invalid network specified', promiEvent);
    }

    return promiEvent.eventEmitter;
};

/**
 * wrapper for setChainId
 */
Transaction.prototype.setNetworkId = function(networkId, promiEvent){
    return this.setChainId(networkId, promiEvent);
};

Transaction.prototype.setNonce = function(nonce, promiEvent){
    var self = this;
    self.resetProperty('nonce');
    promiEvent = promiEvent || new Web3PromiEvent();

    if (nonce){
        self.nonce = nonce;
        self.updateState('setNonce', promiEvent);
    } else {
        if (!self.client){
            return self.invalidate(
                'nonce',
                'cannot set nonce with no client available',
                promiEvent
            );
        }

        // NOTE if sender address not set we cannot get the
        //      transaction count. once sender address is
        //      set it must ensure the nonce is set too
        if (!self.from){
            return self.invalidate(
                'nonce',
                'cannot set nonce without sender address',
                promiEvent
            );
        }

        // get nonce from client
        self.client.eth.getTransactionCount(self.from)
            .then(function(result){
                self.nonce = result;
                self.updateState('setNonce', promiEvent);
            })
            .catch(function(error){
                self.invalidate('nonce', error.message, promiEvent);
            });
    }

    return promiEvent.eventEmitter;
};

Transaction.prototype.setReceiverAddress = function(address, promiEvent){
    var self = this;
    self.resetProperty('to');
    promiEvent = promiEvent || new Web3PromiEvent();
    
    if (!utils[self.network].isValidAddress){
        return self.invalidate('to', 'invalid receiver address', promiEvent);
    }

    self.to = address;
    self.updateState('setReceiverAddress', promiEvent);

    return promiEvent.eventEmitter;
};

Transaction.prototype.setSenderAddress = function(address, promiEvent){
    var self = this;
    self.resetProperty('from');
    promiEvent = promiEvent || new Web3PromiEvent();
    
    if (!utils[self.network].isValidAddress){
        return self.invalidate('from', 'invalid sender address');
    }

    self.from = address;

    // updateBalance will call updateState
    self.updateBalance(promiEvent);

    // ensure nonce is set (which will call updateState)
    self.setNonce(self.nonce, promiEvent);

    return promiEvent;
};

/**
 * we need to store the value using ethereum denominations (because
 * web3.js is for ethereum), so regardless of what is sent we must
 * store the value in wei.
 */
Transaction.prototype.setValue = function(value, denomination, promiEvent){
    var self = this;
    self.resetProperty('value');
    promiEvent = promiEvent || new Web3PromiEvent();

    if (!denomination){
        denomination = utils[self.network].defaultDenomination;
    }

    // convert the denomination from the current network denomination
    // to ethereum network equivalent
    denomination = units.convert(
        denomination,
        self.network
    );

    // see https://web3js.readthedocs.io/en/1.0/web3-utils.html#towei
    self.value = Web3.utils.toWei(value, denomination);
    self.updateState('setValue', promiEvent);

    return promiEvent.eventEmitter;
};

/**
 * returns the signed transport object
 */
Transaction.prototype.signTransaction = function(privateKey){
    var self = this;

    if (self.state === STATE_READY){
        try {
            var signedTransaction = utils[self.network].signRawTransaction(
                self.getTransportTransaction(),
                privateKey
            );
            return '0x' + signedTransaction.toString('hex');
        } catch (exception){
            throw new Error('cannot sign transaction for unsupported network');
        }
    }

    throw new Error('cannot sign incomplete transaction');
};

Transaction.prototype.updateBalance = function(promiEvent){
    var self = this;
    self.resetProperty('balance');
    promiEvent = promiEvent || new Web3PromiEvent();

    if (!self.client){
        return self.invalidate('balance', 'cannot get balance with no client available', promiEvent);
    }

    // NOTE if sender address not set we cannot get the
    //      balance. once sender address is
    //      set it must ensure the balance is retrieved too
    if (!self.from){
        return self.invalidate(
            'balance',
            'cannot update balance without sender address',
            promiEvent
        );
    }

    // get balance from client
    self.client.eth.getBalance(self.from)
        .then(function(balance){
            self.balance = balance;
            self.updateState('balance', promiEvent);
        })
        .catch(function(error){
            self.invalidate('balance', error.message, promiEvent);
        });
    
    return promiEvent.eventEmitter;
};

Transaction.prototype.updateState = function(caller, promiEvent){
    //console.log('updateState called from ' + caller);
    var self = this;
    promiEvent = promiEvent || new Web3PromiEvent();

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
        self.data != null &&
        self.balance != null
    ) {
        self.state = STATE_READY;
        promiEvent.resolve(self);
    } else {
        // no need to do anything when transaction isn't ready
        // console.log(self.getRawTransaction());
    }

    return promiEvent.eventEmitter;
};

/**
 * ensures that account has sufficient balance and that
 * transaction state is ready
 */
Transaction.prototype.validate = function(){
    var self = this;
    var promiEvent = Web3PromiEvent();

    if (self.state == STATE_READY){
        self.checkSufficientFunds()
        .then(function(hasSufficientFunds){
            if (hasSufficientFunds){
                promiEvent.resolve();
            } else {
                promiEvent.reject(new Error('transaction invalid: insufficient funds'));
            }
        });
    } else {
        var error = new Error('transaction invalid: not ready');
        promiEvent.eventEmitter.emit('error', error);
        promiEvent.reject(error);
    }

    return promiEvent.eventEmitter;
};

/**
 * creates a transaction instance using a promiEvent,
 * which will resolve when transaction is ready and fire error
 * events whenever there are issues
 * @param {*} client 
 * @param {*} transaction 
 */
var createTransaction = function(client, transaction){
    var promiEvent = new Web3PromiEvent();
    var transaction = new Transaction(client, transaction, promiEvent);
    return promiEvent.eventEmitter;
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