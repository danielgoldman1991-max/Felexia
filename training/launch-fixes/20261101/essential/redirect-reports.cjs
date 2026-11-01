const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { syncBuiltinESMExports } = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const writeSync = fs.writeFileSync.bind(fs);
const writeAsync = fs.promises.writeFile.bind(fs.promises);
function destination(file) {
  if (typeof file !== 'string' && !(file instanceof URL)) return file;
  const relative = path.relative(path.join(root, 'training'), path.resolve(file instanceof URL ? fileURLToPath(file) : file));
  if (relative.startsWith('..') || path.isAbsolute(relative) || /^launch-(audit|fixes)[\\/]/.test(relative)) return file;
  const output = path.join(__dirname, 'reports', relative);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  return output;
}
fs.writeFileSync = (file, ...args) => writeSync(destination(file), ...args);
fs.promises.writeFile = (file, ...args) => writeAsync(destination(file), ...args);
syncBuiltinESMExports();
