/* Redirect fresh regression reports without replacing the historical JSON proofs. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const originalWrite = fs.writeFileSync.bind(fs);
fs.writeFileSync = (file, ...args) => {
  const target = typeof file === 'string' ? path.resolve(file) : null;
  return originalWrite(target && target.startsWith(path.join(root, 'training') + path.sep) && target.endsWith('.json') ? path.join(__dirname, path.basename(target)) : file, ...args);
};
const script = path.resolve(root, process.argv[2] ?? '');
if (!script.startsWith(path.join(root, 'training') + path.sep) || !script.endsWith('.cjs')) throw Error('Expected a training regression');
require(script);
