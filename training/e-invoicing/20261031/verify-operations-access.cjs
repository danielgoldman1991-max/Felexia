/* eslint-disable @typescript-eslint/no-require-imports -- Controlled SDK boundaries for the actual access service. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createActionRunner } = require('../../../scripts/essential-action-runner.cjs');
const organizationId = '10000000-0000-4000-8000-000000000103';
let role = 'admin', expired = false, installed = true, enabled = true;
let capability = { workflow_version: 2, atomic_issuance: true }, capabilityError = null;
const calls = [], results = [];
const client = {
  from(table) {
    assert.equal(table, 'einvoice_settings');
    const query = { select() { return query; }, eq(field, value) { assert.equal(field, 'organization_id'); assert.equal(value, organizationId); return query; }, async maybeSingle() {
      return installed ? { data: { organization_id: organizationId, enabled, connector_mode: 'disabled', configuration: {}, revision: 1 }, error: null } : { data: null, error: { code: '42P01' } };
    } };
    return query;
  },
  async rpc(name, args) { calls.push({ name, args }); return { data: capability, error: capabilityError }; },
};
const runner = createActionRunner(() => client, [], { modules: { '@/lib/auth': { async requireActiveWorkspace() { return {
  userId: organizationId, organization: { id: organizationId, name: 'Synthetic workspace' }, role,
  subscription: { status: 'active', planCode: 'essentiel', currentPeriodEnd: expired ? '2000-01-01T00:00:00Z' : '2099-01-01T00:00:00Z', trialEndsAt: null },
}; } } } });
const { getEinvoiceContext, assertEinvoiceConfiguration } = runner.load('src/lib/e-invoicing/access.ts');
const check = (name, value) => { assert.ok(value, name); results.push(name); };

async function main() {
  const old = process.env.FELEXIA_EINVOICING_ENABLED;
  process.env.FELEXIA_EINVOICING_ENABLED = 'true';
  try {
    installed = false;
    let context = await getEinvoiceContext();
    check('A missing schema never appears active', !context.migrationReady && !context.operationsReady && !context.enabled && !context.canWrite);
    check('Missing tables do not trigger a capability operation', calls.length === 0);
    installed = true; capabilityError = { code: 'PGRST202' }; capability = null;
    context = await getEinvoiceContext();
    check('Migration102 alone preserves the read client but disables new writes', context.migrationReady && !context.operationsReady && !context.enabled && !context.canWrite && context.client === client);
    assert.throws(() => assertEinvoiceConfiguration(context), error => error.code === 'SETUP_REQUIRED'); results.push('An administrator cannot advertise activation before atomic issuance is installed');
    capabilityError = null; capability = { workflow_version: 2, atomic_issuance: true };
    context = await getEinvoiceContext();
    check('Documents mode is genuinely active with both installed capabilities', context.enabled && context.operationsReady && context.canWrite);
    enabled = false; context = await getEinvoiceContext();
    check('A disabled enterprise remains inactive', !context.enabled && !context.canWrite);
    assert.doesNotThrow(() => assertEinvoiceConfiguration(context)); results.push('A ready administrator can activate a disabled enterprise');
    enabled = true; role = 'viewer'; context = await getEinvoiceContext();
    check('A reader can use the installed document service without write access', context.enabled && context.operationsReady && !context.canWrite && !context.canAdmin);
    role = 'admin'; expired = true; context = await getEinvoiceContext();
    check('Expired subscriptions retain the read boundary and lose mutations', context.enabled && !context.canWrite && !context.writableSubscription && context.client === client);
    expired = false; capability = { workflow_version: 1, atomic_issuance: true }; context = await getEinvoiceContext();
    check('An outdated capability cannot activate the new workflow', !context.operationsReady && !context.enabled);
    capability = { workflow_version: 2, atomic_issuance: false }; context = await getEinvoiceContext();
    check('Incomplete atomic issuance never produces a false active state', !context.operationsReady && !context.enabled);
    check('Every readiness call is read-only and scoped to the session workspace', calls.every(call => call.name === 'einvoice_get_capabilities' && Object.keys(call.args).length === 1 && call.args.p_organization_id === organizationId));
    const report = { passed: true, checks: results.length, results, scope: 'Actual server access logic with controlled session/SDK boundaries; no network, production or database mutation' };
    fs.writeFileSync(path.join(__dirname, 'operations-access.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { if (old === undefined) delete process.env.FELEXIA_EINVOICING_ENABLED; else process.env.FELEXIA_EINVOICING_ENABLED = old; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
