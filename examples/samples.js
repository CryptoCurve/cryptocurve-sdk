var samples = {
    "Try your own code": {
        code: `
        <textarea id="yourowncode" rows="15" cols="50">setResult('result!');</textarea>
        `
    },
    "Get network protocol version": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-net.html#getid">https://web3js.readthedocs.io/en/1.0/web3-net.html#getid</a>
sdk.eth.net.getId()
    .then(function(result){
        setFinalResult(JSON.stringify(result) + ' <a href="#networkversionhelp">(?)</a>')
    })    .catch(function(err){
        setFinalResult('error: ' + err.message + '\\n');
    });
        `
    },
    "Get number of node peers": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-net.html#getpeercount">https://web3js.readthedocs.io/en/1.0/web3-net.html#getpeercount</a>
sdk.eth.net.getPeerCount()
    .then(setFinalResult);
        `
    },
    "Subscribe to logs": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth-subscribe.html#subscribe">https://web3js.readthedocs.io/en/1.0/web3-eth-subscribe.html#subscribe</a>
var subscription = sdk.eth.subscribe('logs', {}, function(error, result){
    if (error) setFinalResult(error.message);
    else setFinalResult(result);
});
        `
    },
    "Clear web3.js subscriptions": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth-subscribe.html#clearsubscriptions">https://web3js.readthedocs.io/en/1.0/web3-eth-subscribe.html#clearsubscriptions</a>
try {
    sdk.eth.clearSubscriptions();
} catch (exception){
    // ignore the exception thrown when no subscriptions are active
    if (exception.message != 'Cannot convert undefined or null to object') {
        throw exception;
    }
}
setFinalResult('subscriptions cleared');
        `
    },
    "Test Keccak-256 SHA3 hash": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-utils.html#sha3">https://web3js.readthedocs.io/en/1.0/web3-utils.html#sha3</a>
var hash = sdk.utils.keccak256("Some string to be hashed");
// expected => "0xed973b234cf2238052c9ac87072c71bcf33abc1bbd721018e0cca448ef79b379"
setResult(hash, 'hash');

var hashOfHash = sdk.utils.keccak256(hash, {encoding: 'hex'});
// expected => "0x85dd39c91a64167ba20732b228251e67caed1462d4bcf036af88dc6856d0fdcc"
setFinalResult(hashOfHash, 'hashOfHash');
         `,
        init: function(){
            setResult(`
                <div id="hash"></div>
                <div id="hashOfHash"></div>
            `);
        }
    },
    "Check coinbase account balance": {
        code: `
sdk.eth.getCoinbase()
.then(function(address) {
    setResult(address, 'coinbase');
    sdk.eth.getBalance(address)
    .then(function(balance){
        setFinalResult(balance, 'balance');
    });
})
.catch(function(err){
    setFinalResult(err.message, 'coinbase');
});
        `,
        init: function(){
            setResult(`
                <div id="coinbase"></div>
                <div id="balance"></div>
            `);
        }
    },
    "List accounts": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth.html#getaccounts">https://web3js.readthedocs.io/en/1.0/web3-eth.html#getaccounts</a>
sdk.eth.getAccounts(function (error, result){
    if (error){ return handleException(error); }
    var resultString = '';
    for (var i in result){
        resultString += result[i] + '\\n';
    }
    setFinalResult(resultString);
});
        `
    },
    "Check all account balances": {
        code: `
// TODO merge accounts from node with test accounts

var accountsTotal, accountsChecked = 0;
sdk.eth.getAccounts(function (error, accounts) {
    if (error){ return handleException(error); }

    accountsTotal = accounts.length;

    for (var i in accounts) {
        getBalance(accounts[i]);
    }
});

var getBalance = function(address){
    sdk.eth.getBalance(address)
    .then(function(balance){
        getMaxAndTotal(address, balance);
    });
};

var resultString = '';
var total = sdk.utils.toBN(0);

var getMaxAndTotal = function(address, balance){
    balance = sdk.utils.toBN(balance);
    total = total.add(balance);

    resultString += '\\n' + address + ': ' + balance;
    
    accountsChecked++;
    if (accountsChecked == accountsTotal) {
        setResult(resultString, 'balances');
        setFinalResult(total, 'total');
    }
};
        `,
        init: function(){
            setResult(`
                <div id="balances"></div>
                <div id="total"></div>
            `);
        }
    },
    "Set default sending account for unsigned transactions": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth.html#defaultaccount">https://web3js.readthedocs.io/en/1.0/web3-eth.html#defaultaccount</a>
setResult(sdk.eth.defaultAccount, 'before');

// set the default account to the client node account with the most ether

var accountsTotal = 0, accountsChecked = 0;
var accountBalances = {};

sdk.eth.getAccounts(function (error, accounts) {
    if (error){ return handleException(error); }

    // add accounts to accountBalances
    for (var i in accounts){
        var address = accounts[i];
        if (!accountBalances[address]) {
            accountBalances[address] = sdk.utils.toBN(0);
            accountsTotal++;
        }
    }

    for (var address in accountBalances) {
        getBalance(address);
    }
});

var getBalance = function(address){
    sdk.eth.getBalance(address)
    .then(function(balance){
        getMaxAndTotal(address, balance);
    });
};

var newDefaultAccount,
    total = sdk.utils.toBN(0);

var getMaxAndTotal = function(address, balance){
    balance = sdk.utils.toBN(balance);
    accountBalances[address] = balance;
    total = total.add(balance);

    accountsChecked++;
    // display the result once the accounts have all been checked
    if (accountsChecked == accountsTotal) {
        
        for (var address in accountBalances){
            if (!newDefaultAccount) {
                newDefaultAccount = address;
            } else {
                // if current balance is greater than the previous
                var previousBalance = accountBalances[newDefaultAccount];
                var currentBalance = accountBalances[address];
                if (currentBalance.gt(previousBalance)) {
                    newDefaultAccount = address;
                }
            }
        }

        sdk.eth.defaultAccount = newDefaultAccount;
        setResult(sdk.eth.defaultAccount, 'after');
        setResult(accountBalances[newDefaultAccount], 'balance');
        setFinalResult(total, 'total');
    }
};
       `,
        init: function(){
            setResult(`
                <div id="before"></div>
                <div id="after"></div>
                <div id="balance"></div>
                <div id="total"></div>
            `);
        }
    },
    "Send tokens from unlocked account on the node": {
        code: `
// derived from <a href="https://davekiss.com/ethereum-web3-node-tutorial/">https://davekiss.com/ethereum-web3-node-tutorial/</a> and
//     <a href="https://medium.com/coinmonks/signing-and-making-transactions-on-ethereum-using-web3-js-1b5663207d63">https://medium.com/coinmonks/signing-and-making-transactions-on-ethereum-using-web3-js-1b5663207d63</a>

setResult(blockchainNetwork, 'blockchainNetwork');

// ensure that the default sending account has been set
if (!sdk.eth.defaultAccount){
    throw new Error('Run "Get and set default sending account for transactions" first');
}
var sourceAccount = sdk.eth.defaultAccount;
setResult(sourceAccount, 'sourceAccount');

// set the receiving account to another test account
var targetAccount = null;
for (var accountAddress in testAccounts[blockchainNetwork]) {
    if (!targetAccount &&
        (accountAddress.toLowerCase() != sourceAccount.toLowerCase())
    ) {
        targetAccount = accountAddress;
    }
}
setResult(targetAccount, 'targetAccount');

// determine initial balances

sdk.eth.getBalance(sourceAccount)
    .then(function(balance){
        setResult(balance, 'initialBalanceInSourceAccount');
    })
    .catch(function(err){
        setResult('ERROR: ' + err.message, 'initialBalanceInSourceAccount');
    });
    
sdk.eth.getBalance(targetAccount)
    .then(function(balance){
        setResult(balance, 'initialBalanceInTargetAccount');
    })
    .catch(function(err){
        setResult('ERROR: ' + err.message, 'initialBalanceInTargetAccount');
    });

// set amount of ether / wan to be transferred
var value = '0.001';
var denomination = sdkUtils[blockchainNetwork].defaultDenomination;
setResult(value + ' ' + denomination, 'valueToBeSent');

setResult('sending...', 'transaction');
// create transaction
// NOTE: blockchainNetwork can be set for the client instead of here using .setBlockchainNetwork(network)
var transaction = {
    "network": blockchainNetwork, // "eth", "wan"
    "from": sourceAccount, // required
    "to": targetAccount, // required
    "value": value, // required
    "denomination": denomination // optional, defaults to "ether" or "wan"
};
setResult(JSON.stringify(transaction), 'transaction');

var transactionConfirmations = '',
    updatedBalanceInSourceAccount = 0, updatedBalanceInTargetAccount = 0;

// see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth-personal.html#unlockaccount">https://web3js.readthedocs.io/en/1.0/web3-eth-personal.html#unlockaccount</a>
sdk.eth.personal.unlockAccount(sourceAccount, "", 600)
    .then(function(){
        // see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth.html?highlight=sendtransaction#sendtransaction">https://web3js.readthedocs.io/en/1.0/web3-eth.html?highlight=sendtransaction#sendtransaction</a>
        sdk.sendTransaction(transaction)
            .on('transactionHash', function(hash){
                setResult(hash, 'transactionHash');
            })
            .on('receipt', function(receipt){
                setResult(JSON.stringify(receipt), 'transactionReceipt');
        
                sdk.eth.getBalance(sourceAccount)
                    .then(function(balance){
                        setResult(balance, 'updatedBalanceInSourceAccount');
                })
                    .catch(function(err){
                        setResult('ERROR: ' + err.message, 'updatedBalanceInSourceAccount');
                    });
                    
                sdk.eth.getBalance(targetAccount)
                    .then(function(balance){
                        setResult(balance, 'updatedBalanceInTargetAccount');
                    })
                    .catch(function(err){
                        setResult('ERROR: ' + err.message, 'updatedBalanceInTargetAccount');
                    });
        
            })
            .on('confirmation', function(confirmationNumber, receipt){
                transactionConfirmations +=
                    '\\n' + confirmationNumber + ': ' + JSON.stringify(receipt) + '\\n';
                // NOTE: there'll be more confirmation messages but setting this result
                //       as final allows execution to continue when running this sample
                //       on node.js  
                setFinalResult(transactionConfirmations, 'transactionConfirmations');
            })
            .on('error', function(error){
                if (error.message.indexOf('insufficient funds for gas * price + value') >= 0) {
                    throw error;
                }
                setResult('transaction failed: ' + error.message, 'transactionHash');
            })
            .catch(function(error){
                if (error.message.indexOf('insufficient funds for gas * price + value') >= 0) {
                    throw error;
                }
                setResult('transaction failed: ' + error.message, 'transactionHash');
            }); // If an out of gas error, the second parameter is the receipt.                
    })
    .catch(function(error){
        setFinalResult(error.message, 'accountLock');
    });
        `,
        init: function(){
            setResult(`
                <div id="blockchainNetwork"></div>
                <div id="before"></div>
                <div id="after"></div>
                <div id="sourceAccount"></div>
                <div id="targetAccount"></div>
                <div id="initialBalanceInSourceAccount"></div>
                <div id="initialBalanceInTargetAccount"></div>
                <div id="valueToBeSent"></div>
                <div id="accountLock"></div>
                <div id="transaction"></div>
                <div id="transactionHash"></div>
                <div id="updatedBalanceInSourceAccount"></div>
                <div id="updatedBalanceInTargetAccount"></div>
                <div id="transactionDetails"></div>
                <div id="transactionReceipt"></div>
                <div id="transactionConfirmations"></div>
                <div id="gasUsed"></div>
            `);
        }
    },
    "Set default sending account for signed transactions": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth.html#defaultaccount">https://web3js.readthedocs.io/en/1.0/web3-eth.html#defaultaccount</a>
setResult(sdk.eth.defaultAccount, 'before');

// set the default account to the test account with the most ether

var accountsTotal = 0, accountsChecked = 0;
var accountBalances = {};
var testAccountAddressess = Object.keys(testAccounts[blockchainNetwork]);
// initialize accountBalances with test accounts
for (var i in testAccountAddressess){
    var address = testAccountAddressess[i];
    accountBalances[address] = sdk.utils.toBN(0);
    accountsTotal++;
}

var getBalance = function(address){
    sdk.eth.getBalance(address)
    .then(function(balance){
        getMaxAndTotal(address, balance);
    });
};

for (var address in accountBalances) {
    getBalance(address);
}

var newDefaultAccount,
    total = sdk.utils.toBN(0);

var getMaxAndTotal = function(address, balance){
    balance = sdk.utils.toBN(balance);
    accountBalances[address] = balance;
    total = total.add(balance);

    accountsChecked++;
    // display the result once the accounts have all been checked
    if (accountsChecked == accountsTotal) {
        for (var address in accountBalances){
            if (!newDefaultAccount) {
                newDefaultAccount = address;
            } else {
                // if current balance is greater than the previous
                var previousBalance = accountBalances[newDefaultAccount];
                var currentBalance = accountBalances[address];
                if (currentBalance.gt(previousBalance)) {
                    newDefaultAccount = address;
                }
            }
        }

        sdk.eth.defaultAccount = newDefaultAccount;
        setResult(sdk.eth.defaultAccount, 'after');
        setResult(accountBalances[newDefaultAccount], 'balance');
        setFinalResult(total, 'total');
    }
};
       `,
        init: function(){
            setResult(`
                <div id="before"></div>
                <div id="after"></div>
                <div id="balance"></div>
                <div id="total"></div>
            `);
        }
    },
    "Send token transaction signed with private key": {
        code: `
// derived from <a href="https://davekiss.com/ethereum-web3-node-tutorial/">https://davekiss.com/ethereum-web3-node-tutorial/</a> and
//     <a href="https://medium.com/coinmonks/signing-and-making-transactions-on-ethereum-using-web3-js-1b5663207d63">https://medium.com/coinmonks/signing-and-making-transactions-on-ethereum-using-web3-js-1b5663207d63</a>

setResult(blockchainNetwork, 'blockchainNetwork');

// ensure that the default sending account has been set
if (!sdk.eth.defaultAccount){
    throw new Error('Run "Get and set default sending account for transactions" first');
}
var sourceAccount = sdk.eth.defaultAccount;
setResult(sourceAccount, 'sourceAccount');
var privateKey = testAccounts.getPrivateKeyByAddress(blockchainNetwork, sourceAccount);
setResult(privateKey, 'privateKey');

// set the receiving account to another test account
var targetAccount = null;
for (var accountAddress in testAccounts[blockchainNetwork]) {
    if (!targetAccount &&
        (accountAddress.toLowerCase() != sourceAccount.toLowerCase())
    ) {
        targetAccount = accountAddress;
    }
}
setResult(targetAccount, 'targetAccount');

// determine initial balances

sdk.eth.getBalance(sourceAccount)
    .then(function(balance){
        setResult(balance, 'initialBalanceInSourceAccount');
    })
    .catch(function(err){
        setResult('ERROR: ' + err.message, 'initialBalanceInSourceAccount');
    });
    
sdk.eth.getBalance(targetAccount)
    .then(function(balance){
        setResult(balance, 'initialBalanceInTargetAccount');
    })
    .catch(function(err){
        setResult('ERROR: ' + err.message, 'initialBalanceInTargetAccount');
    });

// set amount of ether / wan to be transferred
var value = '0.001';
var denomination = sdkUtils[blockchainNetwork].defaultDenomination;
setResult(value + ' ' + denomination, 'valueToBeSent');

setResult('sending...', 'transaction');
// create transaction
var transaction = {
    "network": blockchainNetwork, // "eth", "wan"
    "from": sourceAccount, // required
    "to": targetAccount, // required
    "value": value, // required
    "denomination": denomination // optional, defaults to "ether" or "wan"
};
setResult(JSON.stringify(transaction), 'transaction');

var transactionConfirmations = '';

// see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth.html?highlight=sendtransaction#sendtransaction">https://web3js.readthedocs.io/en/1.0/web3-eth.html?highlight=sendtransaction#sendtransaction</a>
sdk.sendTransaction(transaction, privateKey)
    .on('transactionHash', function(hash){
        setResult(hash, 'transactionHash');
    })
    .on('receipt', function(receipt){
        setResult(JSON.stringify(receipt), 'transactionReceipt');

        sdk.eth.getBalance(sourceAccount)
            .then(function(balance){
                setResult(balance, 'updatedBalanceInSourceAccount');
            })
            .catch(function(err){
                setResult('ERROR: ' + err.message, 'updatedBalanceInSourceAccount');
            });
            
        sdk.eth.getBalance(targetAccount)
            .then(function(balance){
                setResult(balance, 'updatedBalanceInTargetAccount');
            })
            .catch(function(err){
                setResult('ERROR: ' + err.message, 'updatedBalanceInTargetAccount');
            });

    })
    .on('confirmation', function(confirmationNumber, receipt){
        transactionConfirmations +=
            '\\n' + confirmationNumber + ': ' + JSON.stringify(receipt) + '\\n';
        // NOTE: there'll be more confirmation messages but setting this result
        //       as final allows execution to continue when running this sample
        //       on node.js  
        setFinalResult(transactionConfirmations, 'transactionConfirmations');
    })
    .on('error', function(error){
        setResult('transaction failed: ' + error.message, 'transactionHash');
    })
    .catch(function(error){
        setResult('transaction failed: ' + error.message, 'transactionHash');
    }); // If an out of gas error, the second parameter is the receipt.
    `,
        init: function(){
            setResult(`
                <div id="blockchainNetwork"></div>
                <div id="before"></div>
                <div id="after"></div>
                <div id="sourceAccount"></div>
                <div id="privateKey"></div>
                <div id="targetAccount"></div>
                <div id="initialBalanceInSourceAccount"></div>
                <div id="initialBalanceInTargetAccount"></div>
                <div id="valueToBeSent"></div>
                <div id="transaction"></div>
                <div id="transactionHash"></div>
                <div id="updatedBalanceInSourceAccount"></div>
                <div id="updatedBalanceInTargetAccount"></div>
                <div id="transactionDetails"></div>
                <div id="transactionReceipt"></div>
                <div id="transactionConfirmations"></div>
                <div id="gasUsed"></div>
            `);
        }
    }
};

try {
    module.exports = samples;
} catch (exception){
    // ignore exception when included by html
    if (exception.message != 'module is not defined'){
        throw exception;
    }
}
