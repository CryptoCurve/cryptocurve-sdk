# CryptoCurve SDK

A single, simple API for cross-chain (ETH, WAN) functionality.

# Installation

## Browser

Download and include the script from [our release page](https://github.com/CryptoCurve/cryptocurve-sdk/releases/) (or your local `dist` folder after building) in your HTML file and instantiate an instance as follows:

```
<script src="cryptocurve-sdk.min.js"></script>
```

## node.js

`npm install cryptocurve-sdk`

# Folders

- `bin`: the compiled node.js application
- `dist`: the browserfied script for web clients
- `examples`: sample code to demonstrate usage
- `src`: all source code

# Building

`npm run build` runs `tsc` to compile from typescript into the `bin/` folder, then `browserify` to compile into the `dist/` folder, then `uglify` to minify the result.

# Usage

After creating an instance of the SDK.Client class (see below for details), the following methods will be available:

```
sdk.setBlockchainNetwork(network);
sdk.setProvider(host, timeout, username, password);
sdk.sendTransaction(transaction, privateKey);
```
NOTE: either setBlockchainNetwork must be called or the transaction object must contain the network identifier, eg.
```
transaction.network = 'eth';
```
which can be `eth` for ethereum or `wan` for wanchain. If not supplied, the sending protocol will default to the ethereum network.

Additionally, `web3.js` objects and methods can be accessed via `sdk.web3` or directly on the `sdk` object itself, eg.

```
sdk.eth.getCoinbase()
```

Utility methods are available from the `SDK.utils` library.

See `examples` folder, in particular `samples.js` which can be run from both browser (`dynamic.html`) and node.js (`node dynamic`). Please note that the samples required test accounts to be configured in the `testAccounts.js` file.

## Configuring test accounts

Edit the accounts values at the top of the `testAccounts.js` file in the `examples` folder,
you can create an Etheruem wallet [here](https://www.myetherwallet.com/) and a Wanchain wallet [here](https://wallet.cryptocurve.xyz/account).

To create a coinbase account, enter the console and run
```
// miner.setEtherbase(address) eg.
miner.setEtherbase("0x77f92a6b4b61319e538a6bc5345ad5eaab8d8654")
```

## Browser

Include the script from [our release page](https://github.com/CryptoCurve/cryptocurve-sdk/releases/) (or your local `dist` folder after building) in your HTML file and instantiate an instance as follows:

```
<script src="cryptocurve-sdk.js"></script>
<script type="text/javascript">
// if hostname is null, defaults to http://localhost:8545
var sdk = new window.cryptocurve.sdk.Client(hostname);
sdk.setProvider(hostname);

sdk.eth.getCoinbase()...
sdk.web3.eth.getCoinbase()...

var sdkUtils = window.cryptocurve.sdk.utils;
</script>
```

## node.js

```
var CryptoCurveSDK = require('cryptocurve-sdk');
var sdk = new CryptoCurveSDK.Client();
var sdkUtils = new CryptoCurveSDK.utils;

sdk.eth.net.getId()...

```

## Transactions

`CryptoCurveSDK.Client.createTransaction` returns a promise that resolves with the prepared transaction object:

```
sdk.createTransaction({...})
   .then(function(transaction){
       // ...
   });
```

NOTE: the SDK client must be connected as the transaction instance will update itself from the blockchain node.

The following methods are available on the Transaction instance:
- `setNetwork(network)` network in ['eth', 'wan']
- `setChainId(id) / setNetworkId(id)` a null id will retrieve the chain id from the client node
- `setReceiverAddress(to)`
- `setSenderAddress(from)`
- `setNonce(nonce)` [null will retrieve the nonce from the client node]
- `setValue(value, denomination)` denomination must be in selected blockchain's unit, eg. if network is 'wan' then denomination must be in wanchain units
- `setData(data)`
- `setGasPrice(gasPrice)` a null gasPrice will retrieve the price from the client node
- `setGasLimit(gasLimit)` a null gasLimit will estimate the gas limit from the client node
- `validate()` returns a promise that resolves if the transaction is ready and valid
- `signTransaction(privateKey)` returns the transaction signed with the supplied private key

An SDK transaction instance can be identified by its `generator` property, which will always be `'cryptocurve-sdk'`:
```
if (transaction.generator === 'cryptocurve-sdk') {
    // ...
}
```

## Utility library

(to be completed)

- [sdkUtil.eth.fromWei](https://web3js.readthedocs.io/en/1.0/web3-utils.html#fromwei)
- sdkUtil.wan.fromWin
- [sdkUtil.eth.toWei](https://web3js.readthedocs.io/en/1.0/web3-utils.html#towei)
- sdkUtil.wan.toWin

## Wallet library

(to be completed)

# Something missing?

Please let us know by opening issues or contributing!