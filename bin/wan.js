'use strict';
var EthTx = require('ethereumjs-tx');
var ethUtil = require('ethereumjs-util');
var values = require('./lib/values');
var wanUtil = require('wanchain-util');
var WanTx = wanUtil.wanchainTx;
function Wan() { }
// WARNING TEMPORARY STATE: functions lifted directly from MyCryptoCurve, must still be cleaned and wrapped
/**
 * Computes a sha3-256 hash of the serialized tx
 * @param {Boolean} [includeSignature=true] whether or not to include the signature
 * @return {Buffer}
 */
Wan.prototype.hash = function (t) {
    var includeSignature = false;
    // EIP155 spec:
    // when computing the hash of a transaction for purposes of signing or recovering,
    // instead of hashing only the first six elements (ie. nonce, gasprice, startgas, to, value, data),
    // hash nine elements, with v replaced by CHAIN_ID, r = 0 and s = 0
    let items;
    if (includeSignature) {
        items = t.raw;
    }
    else {
        if (t._chainId > 0) {
            const raw = t.raw.slice();
            t.v = t._chainId;
            t.r = 0;
            t.s = 0;
            items = t.raw;
            t.raw = raw;
        }
        else {
            items = t.raw.slice(0, 6);
        }
    }
    items.unshift(new Buffer([1]));
    // console.log(items);
    return ethUtil.rlphash(items);
};
/**
 * sign a transaction with a given a private key
 * @param {any} t
 * @param {Buffer} privateKey
 * @return {Signature}
 */
Wan.prototype.sign = function (t, privateKey) {
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
 * @param {Buffer} privateKey
 * @param {string} msg
 * @return {string}
 */
Wan.prototype.signMessageWithPrivKeyV2 = function (privateKey, msg) {
    const hash = ethUtil.hashPersonalMessage(ethUtil.toBuffer(msg));
    const signed = ethUtil.ecsign(hash, privateKey);
    //console.log(signed);
    const combined = Buffer.concat([
        Buffer.from(signed.r),
        Buffer.from(signed.s),
        Buffer.from([signed.v])
    ]);
    const combinedHex = combined.toString('hex');
    return ethUtil.addHexPrefix(combinedHex);
};
// eth signing? TODO reverse parameter order
/**
 * sign a transaction with a given a private key
 * @param {Buffer} privateKey
 * @param {EthTx} t
 * @return {Buffer}
 */
Wan.prototype.signRawTxWithPrivKey = function (privateKey, t) {
    t.sign(privateKey);
    return t.serialize();
};
// adapted from:
// https://github.com/kvhnuke/etherwallet/blob/2a5bc0db1c65906b14d8c33ce9101788c70d3774/app/scripts/controllers/signMsgCtrl.js#L118
/**
 * @param {ISignedMessage} privateKey
 * @param {EthTx} t
 * @return {Boolean}
 */
Wan.prototype.verifySignedMessage = function (msgObject) {
    const sigb = new Buffer(values.stripHexPrefixAndLower(msgObject.sig), 'hex');
    if (sigb.length !== 65) {
        return false;
    }
    //TODO: explain what's going on here
    sigb[64] = sigb[64] === 0 || sigb[64] === 1 ? sigb[64] + 27 : sigb[64];
    const hash = msgObject.version === '2' ? ethUtil.hashPersonalMessage(ethUtil.toBuffer(msgObject.msg)) : ethUtil.sha3(msgObject.msg);
    const pubKey = ethUtil.ecrecover(hash, sigb[64], sigb.slice(0, 32), sigb.slice(32, 64));
    var address = values.stripHexPrefixAndLower(msgObject.address);
    var computedAddress = ethUtil.pubToAddress(pubKey).toString('hex');
    return address === computedAddress;
};
/**
 * sign a transaction with a given a private key
 * @param {Buffer} privateKey
 * @param {EthTx} t
 * @return {Buffer}
 */
Wan.prototype.wanSignRawTxWithPrivKey = function (privateKey, t) {
    let rawTx = {
        Txtype: 0x01,
        nonce: ethUtil.bufferToInt(t.nonce),
        gasPrice: 200000000000,
        gasLimit: 47000,
        to: wanUtil.toChecksumAddress('0x' + t.to.toString('hex')),
        value: ethUtil.bufferToInt(t.value),
        data: '0x' + t.data.toString('hex'),
        chainId: t._chainId
    };
    // console.log('wan wanSignRawTxWithPrivKey rawTx ' + rawTx);
    let tx = new WanTx(rawTx);
    tx.sign(privateKey);
    return tx.serialize();
};
try {
    module.exports = Wan;
}
catch (exception) {
    console.log('node.js error: ' + exception.message);
}
//# sourceMappingURL=wan.js.map