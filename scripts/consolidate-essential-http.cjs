/* eslint-disable @typescript-eslint/no-require-imports -- Local evidence consolidation only. */
// Retains both raw reports. Replaces only the explicitly accepted empty-account
// 200 status check with its fresh semantic-not-found/no-leak revalidation.
const fs = require('node:fs'); const path = require('node:path'); const { createHash } = require('node:crypto');
const dir = path.resolve(__dirname, '../training/essential-fixes/20261031');
const rawFile = path.join(dir, 'company-http.json'); const permissionsFile = path.join(dir, 'company-http-permissions.json');
const raw = fs.readFileSync(rawFile); const rerun = fs.readFileSync(permissionsFile); const original = JSON.parse(raw); const permissions = JSON.parse(rerun);
if (original.inProgress || permissions.inProgress || original.error || !permissions.success || original.run !== permissions.run || original.origin !== permissions.origin) throw new Error('Complete matching HTTP and successful permission reports required');
const replacements = [];
const checks = original.checks.map(check => {
  if (check.passed) return check;
  if (check.name !== 'foreign QA bank is unavailable' || check.observed?.status !== 200) throw new Error('Unresolved HTTP check requires investigation: ' + check.name);
  const verified = permissions.checks.find(row => row.role === check.role && row.name === check.name && row.passed && row.observed?.semanticNotFound === true);
  const noLeak = permissions.checks.find(row => row.role === check.role && row.name === 'foreign QA bank leaks no company document content' && row.passed);
  if (!verified || !noLeak) throw new Error('Semantic not-found and no-leak revalidation required');
  replacements.push({ role: check.role, name: check.name, originalStatus: 200, revalidation: 'company-http-permissions.json', criterion: '200 accepted only when the scoped page says Compte introuvable and leaks no foreign content' });
  return { ...verified, revalidatedFrom: 'company-http-permissions.json' };
});
const report = { ...original, date: new Date().toISOString(), success: checks.every(row => row.passed), checks, reviewedCriteria: replacements, evidence: [{ file: 'company-http.json', sha256: createHash('sha256').update(raw).digest('hex') }, { file: 'company-http-permissions.json', sha256: createHash('sha256').update(rerun).digest('hex') }] };
const output = path.join(dir, 'company-http-final.json'); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ success: report.success, checks: checks.length, reviewedCriteria: replacements.length, roles: report.roles, limitations: report.limitations, report: output }));
