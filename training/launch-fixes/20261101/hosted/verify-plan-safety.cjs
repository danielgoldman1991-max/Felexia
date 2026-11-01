/* Never invokes the three-flag execution combination. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const preload = path.join(__dirname, 'deny-plan-network.cjs');
const target = path.join(__dirname, 'verify-hosted-actions.cjs');
const results = [];
for (const [label, flags, expected] of [
  ['default is a no-env no-SDK no-network plan', [], 0],
  ['execute alone is refused', ['--execute-qa-actions'], 1],
  ['missing temporary-PRO permission is refused', ['--execute-qa-actions', '--confirm-sql-105-107'], 1],
  ['missing SQL confirmation is refused', ['--execute-qa-actions', '--allow-temporary-qa-pro'], 1],
]) {
  const result = spawnSync(process.execPath, ['--require', preload, target, ...flags], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, expected, label);
  if (flags.length) assert(result.stderr.includes('Execution requires --confirm-sql-105-107 and --allow-temporary-qa-pro'), label);
  else assert.equal(JSON.parse(result.stdout).mode, 'plan-only');
  assert(!result.stderr.includes('PLAN_MUST_NOT'), label);
  results.push({ label, passed: true, exitCode: result.status });
}
fs.writeFileSync(path.join(__dirname, 'plan-safety.json'), JSON.stringify({ passed: true, checks: results.length, scope: 'Only plan and intentionally incomplete execution flags, with env/SDK/network loading forbidden. The valid execution combination is never tested here.', results }, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, checks: results.length, hostedMutations: 0 }));
