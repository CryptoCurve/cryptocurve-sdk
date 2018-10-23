# CryptoCurve SDK

A single, simple API for cross-chain (ETH, WAN) functionality.

# Installation

`npm install cryptocurve-sdk`

# Folders

- `bin`: the compiled node.js application
- `dist`: the browserfied script for web clients
- `examples`: sample code to demonstrate usage
- `src`: all source code

# Building

`npm run tsc` compiles from `src` into the `bin/` folder

`npm run build` runs `tsc` to compile into the `bin/` folder then `browserify` to compile into the `dist/` folder.

# Usage

`web3.js` objects and methods can be accessed via `sdk.web3` or directly on the `sdk` object

wanchain objects and methods can be access via `sdk.wan` eg.
```
var transactionHash = sdk.wan.hash(transaction);
```

See `examples` folder, in particular `samples.js` which can be run from both browser (`dynamic.html`) and node.js (`node dynamic`). Please note that the samples required test accounts to be configured.

## Configuring test accounts

Edit the accounts values at the top of the `testAccounts.js` file in the `examples` folder,
you can create an Etheruem wallet [here](https://www.myetherwallet.com/) and a Wanchain wallet [here](https://wallet.cryptocurve.xyz/account).

To create a coinbase account, enter the console and run
```
// miner.setEtherbase(address) eg.
miner.setEtherbase("0x77f92a6b4b61319e538a6bc5345ad5eaab8d8654")
```

## Browser

Include the `cryptocurve-sdj.js` script in your HTML file and instantiate an instance as follows:

```
<script src="cryptocurve-sdk.js"></script>
<script type="text/javascript">
// if hostname is null, defaults to http://localhost:8545
sdk = new window.cryptocurve.sdk(hostname);
sdk.setProvider(hostname);

sdk.eth.getCoinbase()...
sdk.web3.eth.getCoinbase()...
</script>
```

## node.js

```
var CryptoCurveSDK = require('cryptocurve-sdk');
var sdk = new CryptoCurveSDK();

sdk.eth.net.getId()...

```

# Something missing?

Please let us know by opening issues or contributing!