/* Runs the actual configuration checker in child processes with synthetic public values only. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const results = [];
for (const scenario of [
  { name: 'modern only', modern: 'fixture-public-modern', expected: 0 },
  { name: 'legacy only', legacy: 'fixture-public-legacy', expected: 0 },
  { name: 'both formats', modern: 'fixture-public-modern', legacy: 'fixture-public-legacy', expected: 0 },
  { name: 'neither', expected: 1 },
]) {
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://felexia.pro', NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.invalid', ...(scenario.modern ? { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: scenario.modern } : {}), ...(scenario.legacy ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: scenario.legacy } : {}) };
  const execution = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-production-config.ts'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(execution.status, scenario.expected, scenario.name + ': ' + execution.stderr);
  const output = execution.stdout + execution.stderr;
  assert(!output.includes('fixture-public-modern') && !output.includes('fixture-public-legacy'), 'No public key content printed');
  assert(!output.includes('ANON_KEY=PRESENT'), 'No misleading unconditional PRESENT detail');
  results.push({ scenario: scenario.name, exitCode: execution.status, passed: true });
}
fs.writeFileSync(path.join(__dirname, 'public-config-fixtures.json'), JSON.stringify({ passed: true, scenarios: results.length, scope: 'Actual checker, synthetic public URL/keys only, no environment file loading, no network.', results }, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, scenarios: results.length }));
