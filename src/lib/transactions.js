'use strict';

var Web3PromiEvent = require('web3-core-promievent');
var utils = require('./utils');
var units = require('./units');
var Web3 = require('web3');

const DO_NOT_QUEUE = true;

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
 * @param {*} client
 * @param {*} transaction
 */
function Transaction(client, transaction, promiEvent) {
    var self = this;
    promiEvent = promiEvent || Web3PromiEvent();

    self.generator = 'cryptocurve-sdk';

    self.state = STATE_PENDING;
    self.invalidProperties = [];

    // setters must be queued so that we don't end up
    // calling the same setter ultiple times with
    // different values, if that's not done then changes
    // might be made after the "ready" promise is resolved 
    self.runningSetter = null;
    self.queuedSetters = [];

    self.setClient(client);

    // locked states for values that are updated dynamically
    // but may be overridden
    self.gasLimitLocked = false;
    self.nonceLocked = false;

    // defer init method call so that the promievent listeners
    // are registered before it begins
    process.nextTick(() => {
        self.init(transaction, promiEvent);
    });
}

Transaction.prototype.init = function(transaction, promiEvent){
    var self = this;
    promiEvent = promiEvent || Web3PromiEvent();

    transaction = transaction || {};

    // default to ethereum network
    transaction.network = transaction.network || NETWORK_ETH;

    self.setNetwork(transaction.network, promiEvent);
    self.setChainId(transaction.chainId, promiEvent);

    self.setReceiverAddress(transaction.to, promiEvent);
    if (transaction.nonce){
        // prevent nonce updates until ready event
        self.nonceLocked = true;
        self.setNonce(transaction.nonce, promiEvent);
    }
    self.setSenderAddress(transaction.from, promiEvent);

    self.setValue(transaction.value, transaction.denomination, promiEvent);

    self.setData(transaction.data, promiEvent);

    // NOTE order is important, gas price and limit
    //      should be the last details set
    if (transaction.gasLimit) {
        // prevent gas limit updates until ready event
        self.gasLimitLocked = true;
    }
    self.setGasPrice(transaction.gasPrice, promiEvent);
    // gas limit must be set via gasPrice unless it's being overridden
    if (transaction.gasLimit) {
        // prevent gas limit updates until ready event
        self.setGasLimit(transaction.gasLimit, promiEvent);
    }

    return promiEvent.eventEmitter;
};

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

Transaction.prototype.emitError = function(promiEvent, error){
    if (!promiEvent.eventEmitter.emit('error', error)){
        console.error('error emission failed: ' + error.message);
    }
};

Transaction.prototype.emitInvalid = function(promiEvent, property, msg){
    if (!promiEvent.eventEmitter.emit('invalid', property, msg)){
        console.error('invalid emission failed: ' + property + ' - ' + msg);
    }
};

Transaction.prototype.emitMessage = function(promiEvent, msg){
    if (!promiEvent.eventEmitter.emit('message', msg)){
        console.error('message emission failed: ' + msg);
    }
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
    promiEvent = promiEvent || Web3PromiEvent();

    self.state = STATE_INVALID;
    self.invalidProperties.push(property);

    self.emitInvalid(promiEvent, property, msg);
    var error = new Error('invalid value "' + property + '": ' + msg);
    self.emitError(promiEvent, error);
    promiEvent.reject(error);

    return promiEvent.eventEmitter;
}

/**
 * add setter call to the queue, ensure that only the latest call
 * will be processed
 */
Transaction.prototype.queueSetter = function(setter, value, promiEvent){
    var self = this;

    // transfer other queued setters to new object
    var queuedSetters = [];
    for (var i in self.queuedSetters){
        var queuedSetter = self.queuedSetters[i];
        // only transfer other setters, we don't want duplicates
        // and the last call will be the one used
        if (queuedSetter.setter != setter){
            queuedSetters.push({
                setter: queuedSetter.setter,
                value: queuedSetter.value,
                promiEvent: queuedSetter.promiEvent
            });
        }
    }

    queuedSetters.push({
        setter: setter,
        value: value,
        promiEvent: promiEvent
    });

    self.queuedSetters = queuedSetters;
    if (!self.runningSetter){
        self.runNextQueuedSetter();
    }
};

Transaction.prototype.resetInvalidState = function(property){
    var self = this;
    var invalidProperties = [];

    // transfer all invalid properties to new array
    // except for the one provided
    for (var i in self.invalidProperties){
        if (self.invalidProperties[i] != property) {
            invalidProperties.push(property);
        }
    }

    self.invalidProperties = invalidProperties;
};

/**
 * reset property value to null and
 * remove from invalidProperties list
 */
Transaction.prototype.resetProperty = function(promiEvent, property){
    var self = this;
    var invalidProperties = [];
    promiEvent = promiEvent || Web3PromiEvent();

    self.emitMessage(promiEvent, 'resetting ' + property);
    self[property] = null;
    self.resetInvalidState(property);

    if (invalidProperties.length == 0){
        self.state = STATE_PENDING;
    }
};

Transaction.prototype.runNextQueuedSetter = function(){
    var self = this;
    var setter = self.queuedSetters.splice(0, 1)[0];
    self.runningSetter = setter;

    switch (setter.setter){
        case 'setValue':
            self.setValue(
                setter.value.value,
                setter.value.denomination,
                setter.promiEvent,
                DO_NOT_QUEUE
            );
            break;
        case 'updateBalance':
            self.updateBalance(setter.promiEvent, DO_NOT_QUEUE);
            break;
        default:
            self[setter.setter](setter.value, setter.promiEvent, DO_NOT_QUEUE);
    }
};

/**
 * if chainId isn't submitted then it must be determined
 * from the client node
 */
Transaction.prototype.setChainId = function(chainId, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setChainId', chainId, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setChainId', chainId, promiEvent);
    }

    self.resetProperty(promiEvent, 'chainId');

    if (chainId){
        self.chainId = chainId;
        self.updateState('chainId', promiEvent);
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
                self.updateState('chainId', promiEvent);
            })
            .catch(function(error){
                self.invalidate('chainId', error.message, promiEvent);
            });
    }
};

/**
 * set sdk client
 */
Transaction.prototype.setClient = function(client, promiEvent){
    promiEvent = promiEvent || Web3PromiEvent();
    this.client = client;
    return promiEvent.eventEmitter;
};

// TBD contract and abi

Transaction.prototype.setData = function(data, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setData', data, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setData', data, promiEvent);
    }
    
    self.data = data || "";
    self.updateState('data', promiEvent);
}

/**
 * gas / gas limit, defined per number of operations required
 * generally 21000 for standard transactions, 200000 during an ICO
 * (note: upper bound from MCC was 800000, but when signing a
 * wanchain transaction it was hard-coded to 47000)
 */
Transaction.prototype.setGasLimit = function(gasLimit, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setGasLimit', gasLimit, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setGasLimit', gasLimit, promiEvent);
    }
    
    self.resetProperty(promiEvent, 'gasLimit');

    if (gasLimit){
        self.gasLimit = gasLimit;
        self.updateState('gasLimit', promiEvent);
    } else {
        // TODO override for WAN network with hardcoded values

        // NOTE if gasPrice and value not set and limit not overridden,
        //      we cannot estimate the limit. once gasPrice is
        //      set it must ensure the limit is set too
        if (!(self.gasPrice && self.value)){
            return self.invalidate('gasLimit', 'cannot estimate gas limit without value and gas price', promiEvent);
        }

        if (!self.client){
            return self.invalidate('gasLimit', 'cannot set gasLimit with no client available', promiEvent);
        }

        self.client.eth.estimateGas(self.getTransportTransaction())
            .then(function(gasLimit){
                self.gasLimit = gasLimit;
                self.updateState('gasLimit', promiEvent);
            })
            .catch(function(error){
                self.invalidate('gasLimit', error.message, promiEvent);
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
Transaction.prototype.setGasPrice = function(gasPrice, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setGasPrice', gasPrice, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setGasPrice', gasPrice, promiEvent);
    }

    // if gas limit not overridden in initial transaction
    if (!self.gasLimitLocked){
        // once gas price has been updated, we must update
        // the gas limit, which is calculated based on the
        // gas price.
        self.queueSetter('setGasLimit', null, promiEvent);
    }
    
    self.resetProperty(promiEvent, 'gasPrice');

    if (gasPrice){
        self.gasPrice = gasPrice;
        self.updateState('gasPrice', promiEvent);
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
                self.updateState('gasPrice', promiEvent);
            })
            .catch(function(error){
                self.invalidate('gasPrice', error.message, promiEvent);
            });
    }
}

Transaction.prototype.setNetwork = function(network, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setNetwork', network, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setNetwork', network, promiEvent);
    }
    
    self.resetProperty(promiEvent, 'network');

    switch (network){
        case NETWORK_ETH:
        case NETWORK_WAN:
            // NOTE: value will always be stored in wei, no need to recalculate
            self.network = network;
            self.updateState('network', promiEvent);
            break;
        default:
            self.invalidate('network', 'invalid network specified', promiEvent);
    }
};

/**
 * wrapper for setChainId
 */
Transaction.prototype.setNetworkId = function(networkId, promiEvent, doNotQueue){
    return this.setChainId(networkId, promiEvent, doNotQueue);
};

Transaction.prototype.setNonce = function(nonce, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setNonce', nonce, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setNonce', nonce, promiEvent);
    }
    
    self.resetProperty(promiEvent, 'nonce');

    if (nonce){
        self.nonce = nonce;
        self.updateState('nonce', promiEvent);
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
                self.updateState('nonce', promiEvent);
            })
            .catch(function(error){
                self.invalidate('nonce', error.message, promiEvent);
            });
    }
};

Transaction.prototype.setReceiverAddress = function(address, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setReceiverAddress', address, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setReceiverAddress', address, promiEvent);
    }
    
    self.resetProperty(promiEvent, 'to');
    
    if (!utils[self.network].isValidAddress){
        return self.invalidate('to', 'invalid receiver address', promiEvent);
    }

    self.to = address;
    self.updateState('to', promiEvent);
};

Transaction.prototype.setSenderAddress = function(address, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setSenderAddress', address, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setSenderAddress', address, promiEvent);
    }

    // once sender has been updated, we can (and should) call
    // updateBalance and setNonce
    self.queueSetter('updateBalance', null, promiEvent);

    // if nonce not overridden in initial transaction
    if (!self.nonceLocked){
        self.queueSetter('setNonce', self.nonce, promiEvent);
    }
    
    self.resetProperty(promiEvent, 'from');
    
    if (!utils[self.network].isValidAddress){
        return self.invalidate('from', 'invalid sender address');
    }

    self.from = address;
    self.updateState('from', promiEvent);
};

/**
 * we need to store the value using ethereum denominations (because
 * web3.js is for ethereum), so regardless of what is sent we must
 * store the value in wei.
 */
Transaction.prototype.setValue = function(value, denomination, promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('setValue', {value, denomination}, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('setValue', {value, denomination}, promiEvent);
    }

    // if gas limit not overridden in initial transaction
    if (!self.gasLimitLocked){
        // once value has been updated, we must update
        // the gas limit, which is calculated based on the
        // value.
        self.queueSetter('setGasLimit', null, promiEvent);
    }    
    
    self.resetProperty(promiEvent, 'value');

    if (!denomination){
        denomination = utils[self.network].defaultDenomination;
    }

    // convert the denomination from the current network denomination
    // to ethereum network equivalent
    try {
        denomination = units.convert(
            denomination,
            self.network
        );    
    } catch (error){
        self.invalidate('value', error.message, promiEvent);
    }

    try {
        // see https://web3js.readthedocs.io/en/1.0/web3-utils.html#towei
        self.value = Web3.utils.toWei(value, denomination);
        self.updateState('value', promiEvent);
    } catch (error){
        self.invalidate('value', 'value ' + value + ' invalid', promiEvent);
    }
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

Transaction.prototype.updateBalance = function(promiEvent, doNotQueue){
    var self = this;
    // external direct call will not have promiEvent or doNotQueue
    // we need to defer those calls to allow promiEvent listener
    // registration
    if (!promiEvent){
        promiEvent = Web3PromiEvent();
        process.nextTick(() => {
            self.queueSetter('updateBalance', null, promiEvent);
        });
        return promiEvent.eventEmitter;
    }

    if (!doNotQueue){
        return self.queueSetter('updateBalance', null, promiEvent);
    }
    
    self.resetProperty(promiEvent, 'balance');

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
};

Transaction.prototype.updateState = function(property, promiEvent){
    var self = this;
    promiEvent = promiEvent || Web3PromiEvent();

    self.emitMessage(promiEvent, 'updateState called from ' + property);
    self.resetInvalidState(property);

    // clear the setter that's just run, run the next
    // if there's any in the queue
    self.runningSetter = null;
    if (self.queuedSetters.length > 0){
        return self.runNextQueuedSetter();
    }

    // this case is precautionary, shouldn't occur
    if (self.invalidProperties.length > 0){
        self.state = STATE_INVALID;
        var error = new Error('invalid properties: ' + self.invalidProperties.join(', '));
        self.emitError(promiEvent, error);
        promiEvent.reject(error);
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
        self.gasLimitLocked = false;
        self.nonceLocked = false;
        promiEvent.resolve(self);
    } else {
        // no need to do anything when transaction isn't ready
        self.emitMessage(promiEvent, 'transaction not ready');
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
        self.emitError(promiEvent, error);
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
    var promiEvent = Web3PromiEvent();
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