'use strict';

var units = require('./units');
var EthTx = require('ethereumjs-tx');
var ethUtil = require('ethereumjs-util');
var uts46 = require('idna-uts46');
var values = require('./values');
var wanUtil = require('wanchain-util');
var WanTx = wanUtil.wanchainTx;
var Web3 = require('web3');

var ensNormalise = function(name: string): string {
    // NOTE: removed try catch, shouldn't have any impact
    return uts46.toUnicode(name, { useStd3ASCII: true, transitional: false });
};

/**
 * Computes a sha3-256 hash of the serialized tx
 * @param {Boolean} [includeSignature=true] whether or not to include the signature
 * @return {Buffer}
 */
var ethHash = function(t: any) {
    var includeSignature = false;

    // EIP155 spec:
    // when computing the hash of a transaction for purposes of signing or recovering,
    // instead of hashing only the first six elements (ie. nonce, gasprice, startgas, to, value, data),
    // hash nine elements, with v replaced by CHAIN_ID, r = 0 and s = 0

    let items;
    if (includeSignature) {
        items = t.raw;
    } else {
        if (t._chainId > 0) {
            const raw = t.raw.slice();
            t.v = t._chainId;
            t.r = 0;
            t.s = 0;
            items = t.raw;
            t.raw = raw;
        } else {
            items = t.raw.slice(0, 6);
        }
}
    items.unshift(new Buffer([1]));

    return ethUtil.rlphash(items);
};

var ethIsChecksumAddress = function(address: string): boolean{
    return address === ethUtil.toChecksumAddress(address);
}

var ethIsValidAddress = function(address: string): boolean {
    if (address === '0x0000000000000000000000000000000000000000') {
        return false;
    }
    if (address.substring(0, 2) !== '0x') {
        return false;
    } else if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
        return false;
    } else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
        return true;
    } else {
        return ethIsChecksumAddress(address);
    }
};

/**
 * sign a transaction with a given a private key
 * @param {any} t
 * @param {Buffer} privateKey
 * @return {Signature}
 */
var ethSign = function(t: any, privateKey: Buffer) {
    const msgHash = this.hash(t);
    const sig = ethUtil.ecsign(msgHash, privateKey);
    if (t._chainId > 0) {
        sig.v += t._chainId * 2 + 8;
    }
    return sig;
};

// adapted from:
// https://github.com/kvhnuke/etherwallet/blob/2a5bc0db1c65906b14d8c33ce9101788c70d3774/app/scripts/controllers/signMsgCtrl.js#L95
/**
 * sign a transaction with a given a private key
 * @param {string} msg
 * @param {Buffer} privateKey
 * @return {string}
 */
var ethSignMessageWithPrivateKey = function(msg: string, privateKey: Buffer): string {
    const hash = ethUtil.hashPersonalMessage(ethUtil.toBuffer(msg));
    const signed = ethUtil.ecsign(hash, privateKey);

    const combined = Buffer.concat([
        Buffer.from(signed.r),
        Buffer.from(signed.s),
        Buffer.from([signed.v])
    ]);
    const combinedHex = combined.toString('hex');

    return ethUtil.addHexPrefix(combinedHex);
};

/**
 * sign a transaction with a given a private key
 * @param {EthTx} t
 * @param {Buffer} privateKey
 * @return {Buffer}
 */
var ethSignRawTransactionWithPrivateKey = function(t: any, privateKey: Buffer | string): Buffer {
    // TODO: does data need a 0x prefix like the 'to' property?
    // TODO: t.data || "";
    privateKey = marshalToBuffer(ethUtil.addHexPrefix(privateKey));
    t.gas = t.gasLimit;

    // TODO can we check if the transaction is already an EthTx instance?
    var tx = new EthTx(t);
    tx.sign(privateKey);
    return tx.serialize();
};

interface ISignedMessage {
    address: string;
    msg: string;
    sig: string;
    version: string;
}

// adapted from:
// https://github.com/kvhnuke/etherwallet/blob/2a5bc0db1c65906b14d8c33ce9101788c70d3774/app/scripts/controllers/signMsgCtrl.js#L118
/**
 * @param {ISignedMessage} privateKey
 * @param {EthTx} t
 * @return {Boolean}
 */
var ethVerifySignedMessage = function(msgObject: ISignedMessage) : Boolean {
    const sigb = new Buffer(values.stripHexPrefixAndLower(msgObject.sig), 'hex');
    if (sigb.length !== 65) {
        return false;
    }
    //TODO: explain what's going on here
    sigb[64] = sigb[64] === 0 || sigb[64] === 1 ? sigb[64] + 27 : sigb[64];
    const hash =
        msgObject.version === '2' ?
            ethUtil.hashPersonalMessage(ethUtil.toBuffer(msgObject.msg)) :
            ethUtil.sha3(msgObject.msg);
    const pubKey = ethUtil.ecrecover(hash, sigb[64], sigb.slice(0, 32), sigb.slice(32, 64));

    var address = values.stripHexPrefixAndLower(msgObject.address);
    var computedAddress = (ethUtil.pubToAddress(pubKey) as Buffer).toString('hex');

    return address === computedAddress;
};

/*export function isValidBTCAddress(address: string): boolean {
  return WalletAddressValidator.validate(address, 'BTC');
}*/

var isValidENSorEtherAddress = function(address: string): boolean {
    return ethIsValidAddress(address) || isValidENSAddress(address);
}

var isValidENSName = function(str: string) {
    try {
        return str.length > 6 && ensNormalise(str) !== '' && str.substring(0, 2) !== '0x';
    } catch (e) {
        return false;
    }
}

var isValidENSAddress = function (address: string): boolean {
    try {
        const normalized = ensNormalise(address);
        const tld = normalized.substr(normalized.lastIndexOf('.') + 1);
        const validTLDs = {
            eth: true,
            test: true,
            reverse: true
        };
        if (validTLDs[tld as keyof typeof validTLDs]) {
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
};

var isValidHex = function (str: string): boolean {
    if (str === '') {
        return true;
    }
    str = str.substring(0, 2) === '0x' ? str.substring(2).toUpperCase() : str.toUpperCase();
    const re = /^[0-9A-F]*$/g; // Match 0 -> unlimited times, 0 being "0x" case
    return re.test(str);
};

var wanIsChecksumAddress = function(address: string): boolean{
    return address === wanToChecksumAddress(address);
}

var wanIsValidAddress = function(address: string): boolean {
    if (address === '0x0000000000000000000000000000000000000000') {
        return false;
    }
    if (address.substring(0, 2) !== '0x') {
        return false;
    } else if (!/^(0x)?[0-9a-f]{40}$/i.test(address)) {
        return false;
        /*} else if (/^(0x)?[0-9a-f]{40}$/.test(address) || /^(0x)?[0-9A-F]{40}$/.test(address)) {
        return true;*/
    } else {
        return wanIsChecksumAddress(address);
    }
};

var marshalToBuffer = function(value: any): Buffer{
    if (Buffer.isBuffer(value)){
        return value;
    }
    return ethUtil.toBuffer(value);
};

var marshalToInt = function(value: Buffer|Number): Number{
    if (!Buffer.isBuffer(value)){
        return value;
    }
    return ethUtil.bufferToInt(value);
};

/**
 * sign a transaction with a given a private key
 * @param {EthTx} t
 * @param {Buffer|string} privateKey
 * @return {Buffer}
 */
var wanSignRawTransactionWithPrivateKey = function(t: any, privateKey: Buffer | string): Buffer {

    t.from = marshalToBuffer(t.from);
    t.to = marshalToBuffer(t.to);
    // TODO: does data need a 0x prefix like the 'to' property?
    // TODO: t.data || "";
    t.data = marshalToBuffer(t.data);
    privateKey = marshalToBuffer(ethUtil.addHexPrefix(privateKey));

    let rawTx = {
        Txtype: 0x01,
        nonce: marshalToInt(t.nonce),
        gasPrice: marshalToInt(t.gasPrice), // 200000000000,
        gasLimit: marshalToInt(t.gasLimit), // 47000,
        from: wanUtil.toChecksumAddress('0x' + t.from.toString('hex')),
        to: wanUtil.toChecksumAddress('0x' + t.to.toString('hex')),
        value: marshalToInt(t.value),
        data: '0x' + t.data.toString('hex'),
        chainId: t._chainId || t.chainId
    };
    // console.log('wan wanSignRawTxWithPrivKey rawTx ' + rawTx);
    let tx = new WanTx(rawTx);
    tx.sign(privateKey);
    return tx.serialize();
};

var wanToChecksumAddress = function (address: string): string {
    /* stripHexPrefix */
    if (typeof address !== 'string') {
        throw new Error('invalid address');
    }
    address = address.slice(0, 2) === '0x' ? address.slice(2) : address;
    address = address.toLowerCase();
    /* toChecksumWaddress */
    const hash = ethUtil.sha3(address).toString('hex');
    let ret = '0x';

    for (let i = 0; i < address.length; i++) {
        if (parseInt(hash[i], 16) < 8) {
            ret += address[i].toUpperCase();
        } else {
            ret += address[i];
        }
    }
    return ret;
};

var sharedUtils: any = {
    addHexPrefix: ethUtil.addHexPrefix,
    bufferToHex: ethUtil.bufferToHex,
    ecsign: ethUtil.ecsign,
    hashPersonalMessage: ethUtil.hashPersonalMessage,
    isValidHex: isValidHex,
    isValidPrivateKey: ethUtil.isValidPrivate,
    padToEven: ethUtil.padToEven,
    privateToAddress: ethUtil.privateToAddress,
    publicToAddress: ethUtil.pubToAddress,
    sha256: ethUtil.sha256,
    sha3: ethUtil.sha3,
    stripHexPrefix: values.stripHexPrefix,
    stripHexPrefixAndLower: values.stripHexPrefixAndLower,
    toBN: Web3.utils.toBN,
    toBuffer: ethUtil.toBuffer,
};

var exportObject: any = {
    eth: {
        defaultDenomination: "ether",
        fromWei: units.fromWei,
        hash: ethHash,
        isChecksumAddress: ethIsChecksumAddress,
        isValidAddress: ethIsValidAddress,
        signTransaction: ethSign,
        signRawTransaction: ethSignRawTransactionWithPrivateKey,
        signMessage: ethSignMessageWithPrivateKey,
        toChecksumAddress: ethUtil.toChecksumAddress,
        toWei: units.toWei,
        Tx: EthTx,
        verifySignedMessage: ethVerifySignedMessage
    },    

    wan: {
        defaultDenomination: "wan",
        fromWin: units.fromWin,
        isChecksumAddress: wanIsChecksumAddress,
        isValidAddress: wanIsValidAddress,
        signRawTransaction: wanSignRawTransactionWithPrivateKey,
        toChecksumAddress: wanToChecksumAddress,
        toWin: units.toWin,
        Tx: WanTx
    }
};

// make shared utils available to all networks in export object
for (var network in exportObject){
    for (var method in sharedUtils){
        exportObject[network][method] = sharedUtils[method];
    }
}

try {
    module.exports = exportObject;
} catch (exception){
    console.log('node.js utils export error: ' + exception.message);
}
