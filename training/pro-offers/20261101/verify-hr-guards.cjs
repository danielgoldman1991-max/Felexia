/* eslint-disable @typescript-eslint/no-require-imports -- Isolated runtime fixture harness. */
// Execute the real TS modules with only session, Supabase and Next boundaries replaced.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
let checks = 0;
const results = [];
function check(condition, label) { assert.ok(condition, label); checks++; results.push(label); }
function compile(file, mocks) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(id => {
    if (!(id in mocks)) throw Error(`Unexpected import ${id}`);
    return mocks[id];
  }, module, module.exports);
  return module.exports;
}
const validEnd = new Date(Date.now() + 86400000).toISOString();
const expiredEnd = new Date(Date.now() - 86400000).toISOString();
let workspace = { organization: { id: 'local-org' }, role: 'admin', subscription: { status: 'active', currentPeriodEnd: validEnd } };
let fullAccess = true;
const subscription = compile('src/lib/subscriptions/subscription-access.ts', {});
const access = compile('src/lib/hr/access.ts', {
  'server-only': {},
  '@/lib/auth': { requireActiveWorkspace: async () => workspace },
  '@/lib/launch-access': { hasFullErpAccess: async org => { assert.equal(org, workspace.organization.id); return fullAccess; } },
  '@/lib/subscriptions/subscription-access': subscription,
});
async function denied(run, pattern, label) { await assert.rejects(run, pattern, label); checks++; results.push(label); }
(async () => {
  check(await access.requireWritableHrWorkspace() === workspace, 'Active PRO admin can manage RH');
  for (const role of ['owner', 'admin', 'hr_manager', 'accountant']) {
    workspace = { ...workspace, role };
    check(await access.requireWritableHrWorkspace() === workspace, `Existing ${role} HR management remains`);
  }
  for (const role of ['viewer', 'operator', 'sales', 'manager', null]) {
    workspace = { ...workspace, role };
    await denied(() => access.requireWritableHrWorkspace(), /droits nécessaires/, `RH mutation denied for ${role}`);
    check(!access.canManageHrWorkspace(workspace), `No reference writes for ${role}`);
  }
  workspace = { ...workspace, role: 'admin', subscription: { status: 'active', currentPeriodEnd: expiredEnd } };
  check(await access.requireHrWorkspace() === workspace, 'Expired PRO preserves RH reads');
  await denied(() => access.requireWritableHrWorkspace(), /consultation/, 'Expired PRO RH mutation denied');
  fullAccess = false;
  await denied(() => access.requireHrWorkspace(), /PRO/, 'Essentiel RH data helper denied without complete access');
  fullAccess = true;
  let referenceWrites = 0;
  let clientCreations = 0;
  const hr = compile('src/lib/hr/hr.ts', {
    '@/lib/supabase/server': { createClient: async () => { clientCreations++; return {}; } },
    '@/lib/hr/access': access,
    '@/lib/hr/reference-data': { ensureHrReferenceData: async () => { referenceWrites++; } },
  });
  await hr.ensureCurrentWorkspaceHrReferenceData();
  check(referenceWrites === 0 && clientCreations === 0, 'Expired PRO loading performs no reference database writes');
  workspace = { ...workspace, role: 'viewer', subscription: { status: 'active', currentPeriodEnd: validEnd } };
  await hr.ensureCurrentWorkspaceHrReferenceData();
  check(referenceWrites === 0 && clientCreations === 0, 'PRO viewer loading performs no reference database writes');
  workspace = { ...workspace, role: 'admin' };
  await hr.ensureCurrentWorkspaceHrReferenceData();
  check(referenceWrites === 1 && clientCreations === 1, 'Active PRO manager can initialize absent references');
  let actionDatabaseCalls = 0;
  const actions = compile('src/lib/hr/actions.ts', {
    'next/navigation': { redirect() { throw Error('Unexpected redirect'); } },
    'next/cache': { revalidatePath() { throw Error('Unexpected revalidation'); } },
    '@/lib/hr/access': { requireWritableHrWorkspace: async () => { throw Error('RH_ACCESS_DENIED'); } },
    '@/lib/supabase/server': { createClient: async () => { actionDatabaseCalls++; return {}; } },
    '@/lib/hr/payroll-engine': { calculatePayslip() { throw Error('Unexpected payroll'); } },
    '@/lib/hr/reference-data': { ensureHrReferenceData() { throw Error('Unexpected initialization'); } },
  });
  for (const name of ['createHrEmployeeAction','updateHrEmployeeAction','createHrContractAction','createHrLeaveRequestAction','createHrPayrollPeriodAction','calculateHrPayrollPeriodAction']) await denied(() => actions[name](new FormData(), new FormData()), /RH_ACCESS_DENIED/, `${name} checks access before any side effect`);
  check(actionDatabaseCalls === 0, 'Rejected RH actions create no database client');
  const referenceData = compile('src/lib/hr/reference-data.ts', {});
  const settings = { default_weekly_hours: 35, ir_brackets: [{ threshold: 1234 }] };
  const before = JSON.stringify(settings);
  let initializedTables = 0;
  const client = { from(table) { return {
    async upsert(rows, options) {
      check(options.ignoreDuplicates === true, `${table} inserts only absent references`);
      initializedTables++;
      if (table === 'hr_settings' && !options.ignoreDuplicates) Object.assign(settings, rows);
      return {};
    },
    select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: 'direction' } }; },
  }; } };
  await referenceData.ensureHrReferenceData(client, 'local-org');
  check(initializedTables === 5 && JSON.stringify(settings) === before, 'RH initialization preserves existing payroll settings');
  const affordances = compile('src/components/hr/hr-management-action.tsx', { '@/lib/hr/access': access });
  workspace = { ...workspace, role: 'viewer' };
  check(await affordances.HrManagementAction({ children: 'Manage' }) === null, 'PRO viewer sees no RH management control');
  workspace = { ...workspace, role: 'admin', subscription: { status: 'active', currentPeriodEnd: expiredEnd } };
  check(await affordances.HrManagementAction({ children: 'Manage' }) === null, 'Expired PRO sees no RH management control');
  workspace = { ...workspace, subscription: { status: 'active', currentPeriodEnd: validEnd } };
  check(await affordances.HrManagementAction({ children: 'Manage' }) === 'Manage', 'Active PRO manager sees RH management control');
  const report = { passed: true, checks, results, scope: 'Real TS modules with session and database boundaries replaced; no production access' };
  fs.writeFileSync(path.join(__dirname, 'hr-guards.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks }));
})().catch(error => { console.error(error); process.exitCode = 1; });
