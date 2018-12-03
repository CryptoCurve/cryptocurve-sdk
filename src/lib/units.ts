'use strict';

var Web3 = require('web3');

function Units(){}

var units: any = {
  eth: {
    wei:        '1',
    kwei:       '1000',
    ada:        '1000',
    femtoether: '1000',
    mwei:       '1000000',
    babbage:    '1000000',
    picoether:  '1000000',
    gwei:       '1000000000',
    shannon:    '1000000000',
    nanoether:  '1000000000',
    nano:       '1000000000',
    szabo:      '1000000000000',
    microether: '1000000000000',
    micro:      '1000000000000',
    finney:     '1000000000000000',
    milliether: '1000000000000000',
    milli:      '1000000000000000',
    ether:      '1000000000000000000',
    kether:     '1000000000000000000000',
    grand:      '1000000000000000000000',
    einstein:   '1000000000000000000000',
    mether:     '1000000000000000000000000',
    gether:     '1000000000000000000000000000',
    tether:     '1000000000000000000000000000000'
  },
  wan: {
    win:    '1',
    kwin:   '1000',
    mwin:   '1000000',
    gwin:   '1000000000',
    szabo:  '1000000000000',
    finney: '1000000000000000',
    wan:    '1000000000000000000'
  }
};

/**
 * @param {string} name unit name
 * @param {string} source source network
 * @param {string} source target network
 * convert unit name to unit on the target network
 * primarily used to employ ethereum function toWei
 */
var convert = function(name: string, source: string, target?: string): string{
  target = target || 'eth';
  // get value of named unit on source network
  var value: string = units[source][name];
  // find first match on the target network
  for (var match in units[target]){
    if (value == units[target][match]){
      return match;
    }
  }
  throw new Error('unable to convert ' + name + ' from ' + source + ' to ' + target);
}

/** 
 * @param value wanchain wrapper for fromWei function
 * @param denomination 
 */
var wanFromWin = function(value: any, denomination: string) {
  denomination = denomination || "wan";
  return Web3.utils.fromWei(value, convert(denomination, "wan", "eth"));
}

/** 
 * @param value wanchain wrapper for toWei function
 * @param denomination 
 */
var wanToWin = function(value: any, denomination: string) {
  denomination = denomination || "wan";
  return Web3.utils.toWei(value, convert(denomination, "wan", "eth"));
}

try {
  module.exports = {
    convert: convert,
    fromWei: Web3.utils.fromWei,
    fromWin: wanFromWin,
    toWei: Web3.utils.toWei,
    toWin: wanToWin
  };
} catch (exception){
  console.log('node.js units export error: ' + exception.message);
}
