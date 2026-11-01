/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const specifications = [
  ['105_pro_commercial_transactions.sql', 'pro_105_actif', 'cc7c5e690766e2355bf3c0c999ece6fc9bef8af9f3d72a2c5afa5557ee0d43cf'],
  ['106_preparatory_payroll_transactions.sql', 'pro_106_actif', 'd7c56e0f41eb02a2c142248562b406a36e74365b30d72ced25d69237e33c59f1'],
  ['107_treasury_default_account_atomic.sql', 'treasury_107_actif', '5eb6b6f579c3498199ffd44cace03466b9fa9425b57e648c9c8dc35cee5802c2'],
];
const parts = [], checks = [], sha256 = {};
for (const [file, flag, expected] of specifications) {
  const bytes = fs.readFileSync(path.join(root, 'supabase/migrations', file));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== expected) throw Error('Reviewed migration changed: ' + file);
  const source = bytes.toString('utf8');
  if ((source.match(/^begin;\r?$/gm) || []).length !== 1 || (source.match(/^commit;\r?$/gm) || []).length !== 1) throw Error('Review transaction boundaries:' + file);
  const indicator = source.match(new RegExp('^select ([\\s\\S]*?) as ' + flag + ';', 'm'));
  if (!indicator) throw Error('Missing readiness indicator:' + file);
  parts.push('-- SOURCE ' + file + ' SHA256 ' + hash + '\n' + source.replace(/^begin;\r?$/gm, '').replace(/^commit;\r?$/gm, ''));
  checks.push('  (' + indicator[1] + ') as ' + flag);
  sha256[file] = hash;
}
const sql = '-- Felexia launch fixes105-107. Apply manually after104. One atomic transaction.\n-- Reviewed source bodies preserved; only their outer BEGIN/COMMIT removed.\nbegin;\n\n' + parts.join('\n\n') + '\n\ncommit;\n\nwith readiness as (\nselect\n' + checks.join(',\n') + '\n)\nselect pro_105_actif and pro_106_actif and treasury_107_actif as launch_105_106_107_actif,\n  pro_105_actif, pro_106_actif, treasury_107_actif\nfrom readiness;\n';
const output = path.join(root, 'supabase/launch-fixes-105-107.sql');
fs.writeFileSync(output, sql);
const bundleSha256 = createHash('sha256').update(sql).digest('hex');
fs.writeFileSync(path.join(__dirname, 'installer-manifest.json'), JSON.stringify({ bundle: 'supabase/launch-fixes-105-107.sql', bundleSha256, migrationSha256: sha256, oneTransaction: true }, null, 2) + '\n');
console.log(JSON.stringify({ bundle: output, bundleSha256 }));
