// private keys recovered from keystore using keythereum
// see https://ethereum.stackexchange.com/a/36022/45919
var accounts = {
    // { address: private key }
    // address must begin with 0x... , private key must not, see examples below
    eth: {
        "0x77f92a6b4b61319e538a6bc5345ad5eaab8d8654": "aa628d568082ee43d2aa946f9dc2d233748b70d5b02de9160783ba9405XXXXXX",
    },
    wan: {
        "0x7DB1E745DE5cC671207dd39Ba236A11f96E2e6fE": "aa628d568082ee43d2aa946f9dc2d233748b70d5b02de9160783ba9405XXXXXX",
    }
};

function TestAccounts() {
    var self = this;
    for (var network in accounts){
        self[network] = accounts[network];
    }
}

TestAccounts.prototype.getAccountByIndex = function(network, index) {
    var i = 0;
    if (index < 0) throw new Error("index invalid");
    for (var address in accounts[network]){
        if (i > index) throw new Error("index invalid");
        if (i == index){
            return {
                address: address,
                privateKey: accounts[network][address]
            };
        }
        i++;
    }
};

TestAccounts.prototype.getPrivateKeyByAddress = function(network, address) {
    var self = this;
    for (var lookupAddress in self[network]){
        if (lookupAddress.toLowerCase() == address.toLowerCase()){
            return self[network][lookupAddress];
        }
    }
    throw new Error("address not found");
};

var testAccounts = new TestAccounts();

try {
    module.exports = testAccounts;
} catch (exception){
    // ignore exception when included by html
    if (exception.message != 'module is not defined'){
        throw exception;
    }
}
