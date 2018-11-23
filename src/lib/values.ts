'use strict';

var values : any = {
  stripHexPrefix: function(value: string): string {
    return value.replace('0x', '');
  },
  stripHexPrefixAndLower: function(value: string): string {
    return values.stripHexPrefix(value).toLowerCase();
  }
};

try {
  module.exports = values;
} catch (exception){
  console.log('node.js values export error: ' + exception.message);
}
