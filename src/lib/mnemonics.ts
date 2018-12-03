'use strict';

var bip39 = require('bip39');
var HDKey = require('hdkey');
var utils = require('./utils');
var values = require('./values');

// see https://iancoleman.io/bip39/#english
// from https://ethereum.stackexchange.com/a/19061/45919 :
// m / purpose' / coin_type' / account' / change / address_index
// TODO this definitely needs its own package like bip32-path but returning numbers instead of hex format
var paths = {
    "eth": {
        default: "m/44'/60'/0'/0",
        ledger: "m/44'/60'/0'",
        singular: "m/0'/0'/0'",
        testnet: "m/44'/1'/0'/0",
        trezor: "m/44'/60'/0'/0"
    },
    "wan": {
        default: "m/44'/5718350'/0'/0"
    }
};

/**
 * retrieve an array of wallets from a mnemonic phrase (with optional password)
 * NOTE: path must not include the address element, /0 will always be added
 * @param phrase 
 * @param password 
 * @param path derivation path
 * @param limit maximum number of addresses to return
 * @param offset address offset for user pagination
 */
var getWallets = function(
    phrase: string,
    password?: string|null,
    path?: string|null,
    limit?: number,
    offset?: number
): any[] {
    var wallets = [];

    // ensure derivation path is set
    path = path || paths.eth.default;

    // set default limit / offset values
    limit = limit || 1;
    offset = offset || 0;

    // validate the mnemonic phrase
    if (!bip39.validateMnemonic(phrase)){
        throw new Error('Invalid mnemonic');
    }

    // get the seed from the phrase
    var seed = bip39.mnemonicToSeed(phrase, password);
    const hdk = HDKey.fromMasterSeed(seed);

    for (var i: number = 0; i < limit; i++) {
        const index = i + offset;
        var derivationPath = `${path}/${index}`;
        const dkey = hdk.derive(derivationPath);
        wallets.push({
            index: index,
            path: derivationPath,
            address: utils.eth.toChecksumAddress(
                utils.eth.publicToAddress(dkey.publicKey, true).toString('hex')
            ),
            privateKey: dkey.privateKey,
            publicKey: dkey.publicKey
        });
    }

    return wallets;
}

try {
    module.exports = {
        paths: paths,
        getWallets
    };
} catch (exception){
    console.log('node.js mnemonics export error: ' + exception.message);
}
