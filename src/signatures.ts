'use strict';

var EthTx = require('ethereumjs-tx');

var ethUtil = require('ethereumjs-util');

var values = require('./lib/values');

var wanUtil = require('wanchain-util');
var WanTx = wanUtil.wanchainTx;

// static function library
function Signatures(){
  var self = this;
  self.eth = {
    hash: self.hash,
    signTransaction: self.sign,
    signRawTransaction: self.signRawTransactionWithPrivateKey,
    signMessage: self.signMessageWithPrivateKey,
    verifySignedMessage: self.verifySignedMessage
  };
  self.wan = {
    signRawTransaction: self.wanSignRawTransactionWithPrivateKey    
  };
}

// WARNING TEMPORARY STATE: functions lifted directly from MyCryptoCurve, must still be cleaned and wrapped

/**
 * Computes a sha3-256 hash of the serialized tx
 * @param {Boolean} [includeSignature=true] whether or not to include the signature
 * @return {Buffer}
 */
Signatures.prototype.hash = function(t: any) {
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
  // console.log(items);

  return ethUtil.rlphash(items);
};

/**
 * sign a transaction with a given a private key
 * @param {any} t
 * @param {Buffer} privateKey
 * @return {Signature}
 */
Signatures.prototype.sign = function(t: any, privateKey: Buffer) {
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
Signatures.prototype.signMessageWithPrivateKey = function(msg: string, privateKey: Buffer): string {
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

/**
 * sign a transaction with a given a private key
 * @param {EthTx} t
 * @param {Buffer} privateKey
 * @return {Buffer}
 */
Signatures.prototype.signRawTransactionWithPrivateKey = function(tx: any, privateKey: Buffer): Buffer {
  // TODO can we check if the transaction is already an EthTx instance?
  tx = new EthTx(tx);
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
Signatures.prototype.verifySignedMessage = function(msgObject: ISignedMessage) : Boolean {
  const sigb = new Buffer(values.stripHexPrefixAndLower(msgObject.sig), 'hex');
  if (sigb.length !== 65) {
    return false;
  }
  //TODO: explain what's going on here
  sigb[64] = sigb[64] === 0 || sigb[64] === 1 ? sigb[64] + 27 : sigb[64];
  const hash = msgObject.version === '2' ? ethUtil.hashPersonalMessage(ethUtil.toBuffer(msgObject.msg)) : ethUtil.sha3(msgObject.msg);
  const pubKey = ethUtil.ecrecover(hash, sigb[64], sigb.slice(0, 32), sigb.slice(32, 64));

  var address = values.stripHexPrefixAndLower(msgObject.address);
  var computedAddress = (ethUtil.pubToAddress(pubKey) as Buffer).toString('hex');

  return address === computedAddress;
};

/**
 * sign a transaction with a given a private key
 * @param {EthTx} t
 * @param {Buffer} privateKey
 * @return {Buffer}
 */
Signatures.prototype.wanSignRawTransactionWithPrivateKey = function(t: any, privateKey: Buffer): Buffer {
    let rawTx = {
        Txtype: 0x01,
        nonce: ethUtil.bufferToInt(t.nonce),
        gasPrice: 200000000000, //bufferToInt(t.gasPrice),
        gasLimit: 47000, //bufferToInt(t.gasLimit),
        to: wanUtil.toChecksumAddress('0x' + t.to.toString('hex')), //contract address
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
  module.exports = Signatures;
} catch (exception){
  console.log('node.js error: ' + exception.message);
}
