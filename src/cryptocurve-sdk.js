'use strict';

var transactions = require('./lib/transactions');

// enable use in both node.js and browser contexts
var exportObject = {
    Client: require('./lib/client'),
    NETWORK_ETH: transactions.NETWORK_ETH,
    NETWORK_WAN: transactions.NETWORK_WAN,
    transactions: transactions,
    utils: require('./lib/utils'),
    wallet: require('./lib/wallet')
};

// node.js
try {
    module.exports = exportObject;
} catch (exception){
    console.log('node.js cryptocurve-sdk export error: ' + exception.message);
}
// browser
try {
    // initialize cryptocurve object if necessary
    window.cryptocurve = window.cryptocurve || {};
    window.cryptocurve.sdk = exportObject;
} catch (exception){
    console.log('web browser cryptocurve-sdk injection error: ' + exception.message);
}
