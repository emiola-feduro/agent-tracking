const path = require("node:path");

function join(a, b) {
  return path.join(a, b);
}

class Store {
  get(key) {}
}

const VERSION = "1.0";

module.exports = { join, Store };
module.exports.extra = function () {};
