const fs = require('node:fs');
const path = require('node:path');
const { syncBuiltinESMExports } = require('node:module');
const source = path.resolve(__dirname, '../../../support-assistant/20261101');
const original = fs.writeFileSync.bind(fs);
fs.writeFileSync = (file, ...args) => {
  const name = typeof file === 'string' ? path.resolve(file) : '';
  return original(name.startsWith(source + path.sep) && name.endsWith('.json') ? path.join(__dirname, path.basename(name)) : file, ...args);
};
syncBuiltinESMExports();
