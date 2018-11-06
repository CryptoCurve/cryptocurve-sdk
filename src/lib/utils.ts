'use strict';

// workaround for typescript's terrible support for node.js modules
var nodeCrypto: any = {
  createHash: require('crypto').createHash,
  createDecipheriv: require('crypto').createDecipheriv
};

var bip39 = require('bip39');
var EthTx = require('ethereumjs-tx');
var ethUtil = require('ethereumjs-util');
var HDKey = require('hdkey');
var values = require('./values');
var wanUtil = require('wanchain-util');
var WanTx = wanUtil.wanchainTx;

var decipherBuffer = function (decipher: any, data: Buffer): Buffer {
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// adapted from https://github.com/kvhnuke/etherwallet/blob/de536ffebb4f2d1af892a32697e89d1a0d906b01/app/scripts/myetherwallet.js#L284
var decodeCryptojsSalt = function (input: string): any {
  const ciphertext = new Buffer(input, 'base64');
  console.log(ciphertext.slice(0, 8).toString());
  if (ciphertext.slice(0, 8).toString() === 'Salted__') {
    return {
      salt: ciphertext.slice(8, 16),
      ciphertext: ciphertext.slice(16)
    };
  } else {
    return {
      ciphertext
    };
  }
}

var decryptMnemonicToPrivateKey = function (
  phrase: string,
  pass: string,
  path: string,
  address: string
): Buffer {
  phrase = phrase.trim();
  address = values.stripHexPrefixAndLower(address);

  if (!bip39.validateMnemonic(phrase)) {
    throw new Error('Invalid mnemonic');
  }

  const seed = bip39.mnemonicToSeed(phrase, pass);
  const derived = HDKey.fromMasterSeed(seed).derive(path);
  const dPrivKey = derived.privateKey;
  const dAddress = ethUtil.privateToAddress(dPrivKey).toString('hex');

  if (dAddress !== address) {
    throw new Error(`Derived ${dAddress}, expected ${address}`);
  }

  return dPrivKey;
}

// adapted from https://github.com/kvhnuke/etherwallet/blob/de536ffebb4f2d1af892a32697e89d1a0d906b01/app/scripts/myetherwallet.js#L230
var decryptPrivateKey = function(encryptedPrivateKey: string, password: string): Buffer {
  const cipher = encryptedPrivateKey.slice(0, 128);
  const decryptedCipher = decodeCryptojsSalt(cipher);
  const evp = evp_kdf(new Buffer(password), decryptedCipher.salt, {
    keysize: 32,
    ivsize: 16
  });

  const decipher = nodeCrypto.createDecipheriv('aes-256-cbc', evp.key, evp.iv);
  const privKey = decipherBuffer(decipher, new Buffer(decryptedCipher.ciphertext));

  return new Buffer(privKey.toString(), 'hex');
}

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
  // console.log(items);

  return ethUtil.rlphash(items);
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
var ethSignRawTransactionWithPrivateKey = function(tx: any, privateKey: Buffer): Buffer {
  // TODO can we check if the transaction is already an EthTx instance?
  tx = new EthTx(tx);
  tx.sign(privateKey);
  return tx.serialize();
};

// adapted from https://github.com/kvhnuke/etherwallet/blob/de536ffebb4f2d1af892a32697e89d1a0d906b01/app/scripts/myetherwallet.js#L297
var evp_kdf = function (data: Buffer, salt: Buffer, opts: any) {
  // A single EVP iteration, returns `D_i`, where block equlas to `D_(i-1)`

  function iter(block: Buffer) {
    let hash = nodeCrypto.createHash(opts.digest || 'md5');
    hash.update(block);
    hash.update(data);
    hash.update(salt);
    block = hash.digest();
    for (let e = 1; e < (opts.count || 1); e++) {
      hash = nodeCrypto.createHash(opts.digest || 'md5');
      hash.update(block);
      block = hash.digest();
    }
    return block;
  }
  const keysize = opts.keysize || 16;
  const ivsize = opts.ivsize || 16;
  const ret: any[] = [];
  let i = 0;
  while (Buffer.concat(ret).length < keysize + ivsize) {
    ret[i] = iter(i === 0 ? new Buffer(0) : ret[i - 1]);
    i++;
  }
  const tmp = Buffer.concat(ret);
  return {
    key: tmp.slice(0, keysize),
    iv: tmp.slice(keysize, keysize + ivsize)
  };
}

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

/**
 * sign a transaction with a given a private key
 * @param {EthTx} t
 * @param {Buffer} privateKey
 * @return {Buffer}
 */
var wanSignRawTransactionWithPrivateKey = function(t: any, privateKey: Buffer): Buffer {
    // to, data: if it's not a buffer then convert it
    if (!Buffer.isBuffer(t.to)){
        t.to = ethUtil.toBuffer(t.to);
    }
    if (!Buffer.isBuffer(t.data)){
        // TODO: does this need a 0x prefix like the 'to' property?
        //t.data = t.data || "";
        t.data = ethUtil.toBuffer(t.data);
    }
    
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
  decryptMnemonicToPrivateKey: decryptMnemonicToPrivateKey,
  decryptPrivateKey: decryptPrivateKey,
  ecsign: ethUtil.ecsign,
  hashPersonalMessage: ethUtil.hashPersonalMessage,
  isValidPrivateKey: ethUtil.isValidPrivate,
  padToEven: ethUtil.padToEven,
  privateToAddress: ethUtil.privateToAddress,
  sha256: ethUtil.sha256,
  sha3: ethUtil.sha3,      
  stripHexPrefix: ethUtil.stripHexPrefix,
  toBuffer: ethUtil.toBuffer,
};

var exportObject: any = {
  eth: {
    hash: ethHash,
    signTransaction: ethSign,
    signRawTransaction: ethSignRawTransactionWithPrivateKey,
    signMessage: ethSignMessageWithPrivateKey,
    toChecksumAddress: ethUtil.toChecksumAddress,
    Tx: EthTx,
    verifySignedMessage: ethVerifySignedMessage
  },    

  wan: {
    decryptMnemonicToPrivateKey: decryptMnemonicToPrivateKey,
    signRawTransaction: wanSignRawTransactionWithPrivateKey,
    toChecksumAddress: wanToChecksumAddress,
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
