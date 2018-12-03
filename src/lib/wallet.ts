'use strict';

var decrypt = require('./decrypt');
var ethJsWallet = require('ethereumjs-wallet');
var ethJsWalletThirdParty = require('ethereumjs-wallet/thirdparty');
var mnemonics = require('./mnemonics');
var utils = require('./utils');

// internal

const KeystoreTypes = {
    presale: 'presale',
    utc: 'v2-v3-utc',
    v1Unencrypted: 'v1-unencrypted',
    v1Encrypted: 'v1-encrypted',
    v2Unencrypted: 'v2-unencrypted'
}

const EncryptedPrivateKeyWallet = (encryptedPrivateKey: string, password: string) =>
    ethJsWallet.fromPrivateKey(decrypt.decryptPrivateKey(encryptedPrivateKey, password));

const PresaleWallet = (keystore: string, password: string) =>
    ethJsWallet.fromEthSale(keystore, password);

const MewV1Wallet = (keystore: string, password: string) =>
    ethJsWalletThirdParty.fromEtherWallet(keystore, password);

const PrivateKeyWallet = (privkey: Buffer) =>
    ethJsWallet.fromPrivateKey(privkey);

const UtcWallet = function(keystore: string, password: string) {
    var rawKeystore = ethJsWallet.fromV3(keystore, password, true);
    var privateKey = rawKeystore.getPrivateKeyString();
    return ethJsWallet.fromPrivateKey(utils.eth.toBuffer(privateKey));
};

function determineKeystoreType(file: string | ArrayBuffer): string {
    const parsed = JSON.parse(file.toString());

    for (var property in parsed) {
        switch (property.toLowerCase()) {
            case 'encseed':
                return KeystoreTypes.presale;
            case 'crypto':
                return KeystoreTypes.utc;
            case 'hash':
                if (parsed.locked === true) {
                    return KeystoreTypes.v1Encrypted;
                }
                if (parsed.locked === false) {
                    return KeystoreTypes.v1Unencrypted;
                }
                break;
            case 'publisher':
                if (parsed.publisher === 'MyEtherWallet') {
                    return KeystoreTypes.v2Unencrypted;
                }
                break;
        }
    }

    throw new Error('Invalid keystore');
}

const isKeystorePassRequired = (file: string | ArrayBuffer): boolean => {
    const keystoreType = determineKeystoreType(file);
    return (
        keystoreType === KeystoreTypes.presale ||
        keystoreType === KeystoreTypes.v1Encrypted ||
        keystoreType === KeystoreTypes.utc
    );
};

const getPrivateKeyWallet = (key: string, password: string) =>
    key.length === 64
        ? PrivateKeyWallet(Buffer.from(key, 'hex'))
        : EncryptedPrivateKeyWallet(key, password);

const getKeystoreWallet = (file: string, password: string) => {
    const parsed = JSON.parse(file);

    switch (determineKeystoreType(file)) {
        case KeystoreTypes.presale:
            return PresaleWallet(file, password);

        case KeystoreTypes.v1Unencrypted:
            return PrivateKeyWallet(Buffer.from(parsed.private, 'hex'));

        case KeystoreTypes.v1Encrypted:
            return MewV1Wallet(file, password);

        case KeystoreTypes.v2Unencrypted:
            return PrivateKeyWallet(Buffer.from(parsed.privKey, 'hex'));

        case KeystoreTypes.utc:
            return UtcWallet(file, password);
        default:
            throw Error('Unknown wallet');
      }
};

/**
 * return wallet objects for the number of wallets specific by
 * limit and offset - this allows for user-controlled pagination
 * @param phrase
 * @param password 
 * @param basePath 
 * @param limit 
 * @param offset 
 */
var getMnemonicWallets = function(
    phrase: string,
    password: string,
    basePath: string,
    limit: number,
    offset: number
){
    return mnemonics.getWallets(phrase, password, basePath, limit, offset);
};

// factory methods

var createFromKeystore = function(keystore: string, password: string) {
    var wallet = getKeystoreWallet(keystore, password);
    return {
        "address": wallet.getAddressString(),
        "privateKey": wallet.getPrivateKeyString(),
        "publicKey": wallet.getPublicKeyString()
    };
};

var createFromPrivateKey = function(privateKey: string, password: string) {
  var wallet = getPrivateKeyWallet(privateKey, password);
  return {
      "address": wallet.getAddressString(),
      "privateKey": wallet.getPrivateKeyString(),
      "publicKey": wallet.getPublicKeyString()
  };
};

try {
    module.exports = {
        createFromKeystore: createFromKeystore,
        createFromPrivateKey: createFromPrivateKey,
        getMnemonicWallets: getMnemonicWallets
    };
} catch (exception){
    console.log('node.js Wallet export error: ' + exception.message);
}