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
    "Get and set default sending account for transactions": {
        code: `
// see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth.html#defaultaccount">https://web3js.readthedocs.io/en/1.0/web3-eth.html#defaultaccount</a>
setResult(sdk.eth.defaultAccount, 'before');

// based on <a href="https://github.com/ethereum/go-ethereum/wiki/Managing-your-accounts#checking-account-balances">https://github.com/ethereum/go-ethereum/wiki/Managing-your-accounts#checking-account-balances</a>
// set the default account to the account with the most ether

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

var newDefaultAccount,
    maxBalance = sdk.utils.toBN(0),
    total = sdk.utils.toBN(0);

var getMaxAndTotal = function(address, balance){
    balance = sdk.utils.toBN(balance);
    total.add(balance);

    // if balance >= maxBalance update the max
    if (balance.gte(maxBalance)){
        newDefaultAccount = address;
        maxBalance = balance;
    }
    
    accountsChecked++;
    // display the result once the accounts have all been checked
    if (accountsChecked == accountsTotal) {
        sdk.eth.defaultAccount = newDefaultAccount;
        setFinalResult(sdk.eth.defaultAccount, 'after');
    }
};
       `,
        init: function(){
            setResult(`
                <div id="before"></div>
                <div id="after"></div>
            `);
        }
    },
    "Check all account balances": {
        code: `
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
    "Send ether from unlocked account on the node": {
        code: `
// derived from <a href="https://davekiss.com/ethereum-web3-node-tutorial/">https://davekiss.com/ethereum-web3-node-tutorial/</a> and
//     <a href="https://medium.com/coinmonks/signing-and-making-transactions-on-ethereum-using-web3-js-1b5663207d63">https://medium.com/coinmonks/signing-and-making-transactions-on-ethereum-using-web3-js-1b5663207d63</a>

// ensure that the default sending account has been set
if (!sdk.eth.defaultAccount){
    throw new Error('Run "Get and set default sending account for transactions" first');
}
var sourceAccount = sdk.eth.defaultAccount;
setResult(sourceAccount, 'sourceAccount');

// set the receiving account to another test account
var targetAccount = null;
for (var accountAddress in testAccounts.eth) {
    if (!targetAccount &&
        (accountAddress.toLowerCase() != sourceAccount.toLowerCase())
    ) {
        targetAccount = accountAddress;
    }
}
setResult(targetAccount, 'targetAccount');

// get gas price

// NOTE: it might be better to retrieve the price from <a href="https://ethgasstation.info/">https://ethgasstation.info/</a>
// see <a href="https://github.com/ethereum/go-ethereum/issues/15825#issuecomment-355872594">https://github.com/ethereum/go-ethereum/issues/15825#issuecomment-355872594</a>

// set gas limit (21000 is the standard)
var gasLimit = 21000;

// set gas price (gas price returned in GWEI)
var gasPrice;
sdk.eth.getGasPrice()
    .then(function(price){
        gasPrice = price * 1e9;
        setResult('price: ' + gasPrice + ' limit: ' + gasLimit, 'gas');
    });

// get the chainId (to prevent replay attacks)
var chainId;
sdk.eth.net.getId()
    .then(function(result){
        chainId = result;
        setResult(chainId  + ' <a href="#networkversionhelp">(?)</a>', 'chainId');
    });

// set transaction identifier
var nonce;
sdk.eth.getTransactionCount(sourceAccount)
    .then(function(result){
        nonce = result;
        setResult(nonce, 'nonce');
    });

// determine initial balances

sdk.eth.getBalance(sourceAccount)
    .then(function(balance){
        setResult(sdk.utils.fromWei(balance, "ether"), 'initialEtherInSourceAccount');
    })
    .catch(function(err){
        setResult('ERROR: ' + err.message, 'initialEtherInSourceAccount');
    });
    
sdk.eth.getBalance(targetAccount)
    .then(function(balance){
        setResult(sdk.utils.fromWei(balance, "ether"), 'initialEtherInTargetAccount');
    })
    .catch(function(err){
        setResult('ERROR: ' + err.message, 'initialEtherInTargetAccount');
    });

// set amount of ether to be transferred
var valueEther = 0.001;
var valueWei = sdk.utils.toWei('0.001', "ether");
var valueHex = sdk.utils.toHex(valueWei);
setResult(valueEther + 'eth ' + valueWei + 'wei ' + valueHex, 'valueToBeSent');

var sendWhenReady = function(){
    var ready = gasPrice != null && chainId != null && nonce != null;
    
    if (!ready){
        setResult('waiting for all transaction data before sending...', 'transaction');
        setTimeout(sendWhenReady, 250)
    } else {
        setResult('sending...', 'transaction');
        // create transaction
        var transaction = {
            "network": "eth", // or "ethereum", "wan", "wanchain"
            "from": sourceAccount, // required
            "to": targetAccount, // required
            "value": sdk.utils.toHex(valueWei), // required
            "gas": sdk.utils.toHex(gasLimit),
            "gasLimit": sdk.utils.toHex(gasLimit),
            "gasPrice": sdk.utils.toHex(gasPrice),
            "chainId": sdk.version.network,
            "nonce": sdk.utils.toHex(nonce)
        };
        setResult(JSON.stringify(transaction), 'transaction');

        var transactionConfirmations = '';
        
        // see <a href="https://web3js.readthedocs.io/en/1.0/web3-eth.html?highlight=sendtransaction#sendtransaction">https://web3js.readthedocs.io/en/1.0/web3-eth.html?highlight=sendtransaction#sendtransaction</a>
        sdk.sendTransaction(transaction)
            .on('transactionHash', function(hash){
                setResult(hash, 'transactionHash');
            })
            .on('receipt', function(receipt){
                setResult(JSON.stringify(receipt), 'transactionReceipt');

                sdk.eth.getBalance(sourceAccount)
                    .then(function(balance){
                        setResult(sdk.utils.fromWei(balance, "ether"), 'updatedEtherInSourceAccount');
                    })
                    .catch(function(err){
                        setResult('ERROR: ' + err.message, 'updatedEtherInSourceAccount');
                    });
                    
                sdk.eth.getBalance(targetAccount)
                    .then(function(balance){
                        setResult(sdk.utils.fromWei(balance, "ether"), 'updatedEtherInTargetAccount');
                    })
                    .catch(function(err){
                        setResult('ERROR: ' + err.message, 'updatedEtherInTargetAccount');
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
                if (error.message != 'insufficient funds for gas * price + value') {
                    throw error;
                }
                setResult('transaction failed: ' + error.message, 'transactionHash');
            }); // If a out of gas error, the second parameter is the receipt.
    }
};

sendWhenReady();
        `,
        init: function(){
            setResult(`
                <div id="before"></div>
                <div id="after"></div>
                <div id="sourceAccount"></div>
                <div id="targetAccount"></div>
                <div id="gas"></div>
                <div id="initialEtherInSourceAccount"></div>
                <div id="initialEtherInTargetAccount"></div>
                <div id="valueToBeSent"></div>
                <div id="chainId"></div>
                <div id="nonce"></div>
                <div id="accountLock"></div>
                <div id="transaction"></div>
                <div id="transactionHash"></div>
                <div id="updatedEtherInSourceAccount"></div>
                <div id="updatedEtherInTargetAccount"></div>
                <div id="transactionDetails"></div>
                <div id="transactionReceipt"></div>
                <div id="transactionConfirmations"></div>
                <div id="gasUsed"></div>
            `);
        }
    },
    "Send ethereum transaction signed with private key": {
        code: `
// derived from <a href="https://davekiss.com/ethereum-web3-node-tutorial/">https://davekiss.com/ethereum-web3-node-tutorial/</a> and
//     <a href="https://medium.com/coinmonks/signing-and-making-transactions-on-ethereum-using-web3-js-1b5663207d63">https://medium.com/coinmonks/signing-and-making-transactions-on-ethereum-using-web3-js-1b5663207d63</a>

// ensure that the default sending account has been set
if (!sdk.eth.defaultAccount){
    throw new Error('Run "Get and set default sending account for transactions" first');
}
var sourceAccount = sdk.eth.defaultAccount;
setResult(sourceAccount, 'sourceAccount');
var privateKey = testAccounts.getPrivateKeyByAddress('eth', sourceAccount);
setResult(privateKey, 'privateKey');

// set the receiving account to another test account
var targetAccount = null;
for (var accountAddress in testAccounts.eth) {
    if (!targetAccount &&
        (accountAddress.toLowerCase() != sourceAccount.toLowerCase())
    ) {
        targetAccount = accountAddress;
    }
}
setResult(targetAccount, 'targetAccount');

// get gas price

// NOTE: it might be better to retrieve the price from <a href="https://ethgasstation.info/">https://ethgasstation.info/</a>
// see <a href="https://github.com/ethereum/go-ethereum/issues/15825#issuecomment-355872594">https://github.com/ethereum/go-ethereum/issues/15825#issuecomment-355872594</a>

// set gas limit (21000 is the standard)
var gasLimit = 21000;

// set gas price (gas price returned in GWEI)
var gasPrice;
sdk.eth.getGasPrice()
    .then(function(price){
        gasPrice = price * 1e9;
        setResult('price: ' + gasPrice + ' limit: ' + gasLimit, 'gas');
    });

// get the chainId (to prevent replay attacks)
var chainId;
sdk.eth.net.getId()
    .then(function(result){
        chainId = result;
        setResult(chainId  + ' <a href="#networkversionhelp">(?)</a>', 'chainId');
    });

// set transaction identifier
var nonce;
sdk.eth.getTransactionCount(sourceAccount)
    .then(function(result){
        nonce = result;
        setResult(nonce, 'nonce');
    });

// determine initial balances

sdk.eth.getBalance(sourceAccount)
    .then(function(balance){
        setResult(sdk.utils.fromWei(balance, "ether"), 'initialEtherInSourceAccount');
    })
    .catch(function(err){
        setResult('ERROR: ' + err.message, 'initialEtherInSourceAccount');
    });
    
sdk.eth.getBalance(targetAccount)
    .then(function(balance){
        setResult(sdk.utils.fromWei(balance, "ether"), 'initialEtherInTargetAccount');
    })
    .catch(function(err){
        setResult('ERROR: ' + err.message, 'initialEtherInTargetAccount');
    });

// set amount of ether to be transferred
var valueEther = 0.001;
var valueWei = sdk.utils.toWei('0.001', "ether");
var valueHex = sdk.utils.toHex(valueWei);
setResult(valueEther + 'eth ' + valueWei + 'wei ' + valueHex, 'valueToBeSent');

var sendWhenReady = function(){
    var ready = gasPrice != null && chainId != null && nonce != null;
    
    if (!ready){
        setResult('waiting for all transaction data before sending...', 'transaction');
        setTimeout(sendWhenReady, 250)
    } else {
        setResult('sending...', 'transaction');
        // create transaction
        var transaction = {
            "network": "eth", // or "ethereum", "wan", "wanchain"
            "from": sourceAccount, // required
            "to": targetAccount, // required
            "value": sdk.utils.toHex(valueWei), // required
            "gas": sdk.utils.toHex(gasLimit),
            "gasLimit": sdk.utils.toHex(gasLimit),
            "gasPrice": sdk.utils.toHex(gasPrice),
            "chainId": sdk.version.network,
            "nonce": sdk.utils.toHex(nonce)
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
                        setResult(sdk.utils.fromWei(balance, "ether"), 'updatedEtherInSourceAccount');
                    })
                    .catch(function(err){
                        setResult('ERROR: ' + err.message, 'updatedEtherInSourceAccount');
                    });
                    
                sdk.eth.getBalance(targetAccount)
                    .then(function(balance){
                        setResult(sdk.utils.fromWei(balance, "ether"), 'updatedEtherInTargetAccount');
                    })
                    .catch(function(err){
                        setResult('ERROR: ' + err.message, 'updatedEtherInTargetAccount');
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
                if (error.message != 'insufficient funds for gas * price + value') {
                    throw error;
                }
                setResult('transaction failed: ' + error.message, 'transactionHash');
            }); // If a out of gas error, the second parameter is the receipt.
    }
};

sendWhenReady();
        `,
        init: function(){
            setResult(`
                <div id="before"></div>
                <div id="after"></div>
                <div id="sourceAccount"></div>
                <div id="privateKey"></div>
                <div id="targetAccount"></div>
                <div id="gas"></div>
                <div id="initialEtherInSourceAccount"></div>
                <div id="initialEtherInTargetAccount"></div>
                <div id="valueToBeSent"></div>
                <div id="chainId"></div>
                <div id="nonce"></div>
                <div id="accountLock"></div>
                <div id="transaction"></div>
                <div id="transactionHash"></div>
                <div id="updatedEtherInSourceAccount"></div>
                <div id="updatedEtherInTargetAccount"></div>
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
