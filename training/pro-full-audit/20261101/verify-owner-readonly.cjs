/* eslint-disable @typescript-eslint/no-require-imports -- Explicit owner-scoped HTTP read audit. */
// HTTP is GET-only. Service access performs scoped SELECTs and session minting.
// Owner identity and authorization live outside Git; no mail is dispatched.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const arg = key => process.argv.find(value => value.startsWith('--' + key + '='))?.slice(key.length + 3);
const origin = arg('origin') || 'http://localhost:3112';
if (!['http://localhost:3112', 'https://www.felexia.pro'].includes(origin)) throw new Error('Only the declared local review or public production origin is allowed');
const outputName = arg('report') || 'host-owner-readonly.json';
if (!/^[a-z0-9-]+\.json$/.test(outputName)) throw new Error('A plain report filename is required');
const output = path.join(__dirname, outputName);
const matrix = JSON.parse(fs.readFileSync(path.join(__dirname, 'route-matrix.json'), 'utf8'));
const publicPages = new Set(['/', '/pricing', '/conditions', '/confidentialite', '/mentions-legales']);
const autoInit = new Map([
  ['/comptabilite', 'GET calls ensureAccountingBaseSetup'],
  ['/comptabilite/plan-comptable', 'GET calls ensureAccountingBaseSetup'],
  ['/comptabilite/journaux', 'Administrator GET calls ensureAccountingBaseSetup'],
  ['/articles/new', 'GET may initialize product categories and units'],
  ['/tiers/new', 'GET may initialize customer categories'],
  ['/facturation/paiements/new', 'GET may create the default treasury account'],
  ['/achats/paiements/new', 'GET may create the default treasury account'],
  ['/facturation/factures/[id]/paiement', 'GET may create the default treasury account'],
  ['/tresorerie/mouvements/new', 'GET may create the default treasury account'],
  ['/tresorerie/releves/import', 'GET may create the default treasury account'],
]);
function exclusion(row) {
  if (autoInit.has(row.route)) return autoInit.get(row.route);
  if (row.route.startsWith('/rh') && row.route !== '/rh/employes/[id]') return 'RH read path may upsert reference data for an administrator; covered separately in synthetic QA';
  if (row.module === 'Onboarding' || row.module === 'Authentification') return 'Identity/onboarding flow excluded from business read audit';
  if (row.module === 'Public ou alias' && !publicPages.has(row.route)) return 'Legacy alias or account recovery flow; canonical page audited instead';
  if (row.state === 'Redirection') return 'Alias/redirect; no additional canonical screen';
  return null;
}
const pageRows = matrix.rows.filter(row => row.kind === 'Page');
const candidates = pageRows.filter(row => !exclusion(row));
const report = {
  date: new Date().toISOString(), origin, companyLabel: 'Authorized owner company',
  scope: 'Real authenticated owner GET requests against canonical pages; no submitted forms, business RPC, payment, invitation, email or fiscal transmission',
  businessWrites: 0, emailsSent: 0, stripeWrites: 0, fiscalTransmissions: 0,
  auth: { privateMailboxVerified: false, activeCompanyVerified: false, newSessionCreated: false, localSessionSignedOut: false },
  exclusions: pageRows.map(row => ({ route: row.route, reason: exclusion(row) })).filter(row => row.reason),
  handlerExclusions: [
    { route: '/api/notifications', reason: 'GET can generate a trial notification' },
    { route: '/comptabilite/tva/exports/[id]/download', reason: 'GET updates download counters, status and an audit row' },
    { route: '/api/cron/*', reason: 'Cron handlers can execute business work' },
    { route: '/auth/*', reason: 'Identity callbacks and logout are outside the GET business audit' },
  ],
  checks: [], pages: [], missingRecords: [], limitations: [
    'HTTP status and SSR content checks do not exercise client-side interactions or submit forms.',
    'Reserved screens remain reserved; a successful GET does not certify a complete feature.',
    'Owner routes with automatic initialization are intentionally excluded to preserve real data.',
  ],
};
function checkpoint() { fs.writeFileSync(output, JSON.stringify({ ...report, inProgress: true }, null, 2) + '\n'); }
function check(name, passed) { report.checks.push({ name, passed: Boolean(passed) }); if (!passed) throw new Error('CHECK_FAILED:' + name); }
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function publicRoute(route) { return String(route).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]'); }
function visible(html) { return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim(); }
const financeTables = [
  'customer_invoices', 'customer_invoice_lines', 'supplier_invoices', 'supplier_invoice_lines',
  'customer_credit_notes', 'customer_credit_note_lines', 'customer_credit_note_applications',
  'supplier_credit_notes', 'supplier_credit_note_lines', 'supplier_credit_note_applications',
  'customer_payments', 'customer_payment_allocations', 'supplier_payments', 'supplier_payment_allocations',
  'treasury_accounts', 'treasury_transactions', 'accounting_entries', 'accounting_entry_lines',
  'accounting_accounts', 'accounting_journals', 'accounting_settings',
];
let service;
let authenticated;
let organizationId;
let beforeFinance;
let privateRunDirectory;
const jar = new Map();
async function readScoped(table, fields = '*', configure, limit = null) {
  let query = service.from(table).select(fields).eq('organization_id', organizationId);
  if (configure) query = configure(query);
  if (limit !== null) query = query.limit(limit);
  const response = await query;
  if (response.error) throw new Error('SCOPED_READ_FAILED:' + table + ':' + response.error.code);
  return response.data || [];
}
async function fingerprint() {
  const tables = {};
  for (const table of financeTables) {
    const rows = [];
    for (let offset = 0; offset < 200000; offset += 1000) {
      const batch = await readScoped(table, '*', query => query.order('id').range(offset, offset + 999));
      rows.push(...batch);
      if (batch.length < 1000) break;
      if (offset === 199000) throw new Error('FINANCIAL_SNAPSHOT_BOUND_EXCEEDED');
    }
    tables[table] = digest(rows);
  }
  return { digest: digest(tables), tables };
}
const entityRules = [
  [/^\/achats\/avoirs\//, 'supplier_credit_notes'], [/^\/achats\/factures\//, 'supplier_invoices'],
  [/^\/achats\/paiements\//, 'supplier_payments'], [/^\/achats\/commandes\//, 'purchase_documents', ['document_type', 'supplier_order']],
  [/^\/achats\/receptions\//, 'purchase_documents', ['document_type', 'supplier_receipt']],
  [/^\/facturation\/avoirs\//, 'customer_credit_notes'], [/^\/facturation\/factures\//, 'customer_invoices'],
  [/^\/facturation\/paiements\//, 'customer_payments'], [/^\/facturation\/relances\//, 'customer_reminders'],
  [/^\/vente\/devis\//, 'sales_documents', ['document_type', 'quote']],
  [/^\/vente\/commandes\//, 'sales_documents', ['document_type', 'order']],
  [/^\/vente\/livraisons\//, 'sales_documents', ['document_type', 'delivery_note']],
  [/^\/vente\/retours\//, 'sales_documents', ['document_type', 'return_note']],
  [/^\/articles\/categories\//, 'product_categories'], [/^\/articles\/unites\//, 'units'], [/^\/articles\/tva\//, 'tax_rates'], [/^\/articles\/\[id\]/, 'products'],
  [/^\/tiers\//, 'third_parties'], [/^\/stock\/emplacements\//, 'warehouses'],
  [/^\/tresorerie\/comptes\//, 'treasury_accounts'], [/^\/tresorerie\/mouvements\//, 'treasury_transactions'],
  [/^\/tresorerie\/previsions\//, 'treasury_forecast_items'], [/^\/tresorerie\/releves\//, 'bank_statement_imports'],
  [/^\/comptabilite\/ecritures\//, 'accounting_entries'], [/^\/comptabilite\/journaux\//, 'accounting_journals'],
  [/^\/comptabilite\/plan-comptable\//, 'accounting_accounts'], [/^\/comptabilite\/tva\/declarations\//, 'vat_declarations'],
  [/^\/rh\/employes\//, 'hr_employees'],
];
async function requests() {
  const list = candidates.filter(row => !row.route.includes('[')).map(row => ({ ...row, concreteRoute: row.route }));
  const entities = new Map();
  for (const row of candidates.filter(item => item.route.includes('['))) {
    if (row.route === '/facturation/electronique/[kind]/[sourceId]') {
      for (const [kind, table] of [['factures', 'customer_invoices'], ['avoirs', 'customer_credit_notes']]) {
        const rows = await readScoped(table, 'id', query => query.order('id'), 1);
        if (rows.length) list.push({ ...row, concreteRoute: row.route.replace('[kind]', kind).replace('[sourceId]', rows[0].id) });
        else report.missingRecords.push({ route: row.route.replace('[kind]', kind), reason: 'No existing scoped source; no data was seeded' });
      }
      continue;
    }
    const rule = entityRules.find(([pattern]) => pattern.test(row.route));
    if (!rule) { report.missingRecords.push({ route: row.route, reason: 'No safe canonical entity mapping' }); continue; }
    const [, table, filter] = rule;
    const cacheKey = table + JSON.stringify(filter || []);
    if (!entities.has(cacheKey)) entities.set(cacheKey, await readScoped(table, 'id', query => filter ? query.eq(...filter).order('id') : query.order('id'), 1));
    const rows = entities.get(cacheKey);
    if (!rows.length) { report.missingRecords.push({ route: row.route, reason: 'No existing scoped record; no data was seeded' }); continue; }
    list.push({ ...row, concreteRoute: row.route.replace('[id]', rows[0].id) });
  }
  for (const kind of ['sales', 'purchases', 'contacts', 'treasury', 'treasury-ledger', 'supplier-credits']) {
    list.push({ route: '/api/exports/' + kind, concreteRoute: '/api/exports/' + kind, module: 'Scoped exports', state: 'CSV read', csv: true });
  }
  // New implementation is read-only and no longer initializes reference data.
  if (process.argv.includes('--include-chart-export')) list.push({ route: '/comptabilite/plan-comptable/export', concreteRoute: '/comptabilite/plan-comptable/export', module: 'Complete chart CSV', state: 'CSV read', csv: true });
  return list;
}
async function requestPage(page) {
  const route = page.concreteRoute;
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('\\')) throw new Error('Unsafe local route');
  const start = Date.now();
  const response = await fetch(origin + route, {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(60000),
    headers: { Cookie: [...jar].map(([name, value]) => name + '=' + value).join('; '), 'Cache-Control': 'no-cache' },
  });
  for (const cookie of response.headers.getSetCookie()) {
    const first = cookie.split(';')[0]; const split = first.indexOf('=');
    if (split < 1) continue;
    const name = first.slice(0, split); const value = first.slice(split + 1);
    if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(cookie)) jar.delete(name); else jar.set(name, value);
  }
  const body = await response.text();
  const text = visible(body);
  const serverError = /application error:|a server-side exception|internal server error|this page could not be rendered/i.test(text);
  const forbiddenRedirect = /\/(?:login|onboarding|parametres\/modules)(?:[?/#]|$)/.test(response.headers.get('location') || '');
  const passed = response.status === 200 && !serverError && !forbiddenRedirect && (page.csv ? response.headers.get('content-type')?.includes('text/csv') : text.length > 20);
  const entry = {
    route: publicRoute(route), template: page.route, module: page.module, inventoryState: page.state,
    status: response.status, passed: Boolean(passed), elapsedMs: Date.now() - start,
    serverError, forbiddenRedirect, csv: Boolean(page.csv),
    ...(response.status >= 300 && response.status < 400 ? { redirectPath: publicRoute(new URL(response.headers.get('location'), origin).pathname) } : {}),
  };
  if (route === '/parametres/abonnement') entry.quoteOnlyVisible = text.includes('Sur devis') && !/1[\s\u202f\u00a0]*290|12[\s\u202f\u00a0]*900/.test(text);
  if (!passed) fs.writeFileSync(path.join(privateRunDirectory, 'response-' + String(report.pages.length).padStart(3, '0') + '.html'), body, { mode: 0o600 });
  report.pages.push(entry);
  if (report.pages.length % 10 === 0) { checkpoint(); console.log(JSON.stringify({ completed: report.pages.length, failed: report.pages.filter(row => !row.passed).length })); }
}
async function main() {
  if (!process.argv.includes('--execute') || !process.argv.includes('--read-only')) throw new Error('Pass --execute --read-only after reviewing all exclusions');
  const privateRoot = fs.realpathSync(path.join(root, '../backups'));
  const grant = JSON.parse(fs.readFileSync(path.join(privateRoot, 'menarapro-pro-evaluation-20261101.json'), 'utf8'));
  const authorization = JSON.parse(fs.readFileSync(path.join(privateRoot, 'essential-fixes-e2e-private.json'), 'utf8'));
  if (!grant.complete || grant.companyName !== 'MENARAPRO' || !grant.organizationId || !grant.userId || !authorization.authorizedMailbox) throw new Error('Explicit private owner authorization is required');
  organizationId = grant.organizationId;
  privateRunDirectory = path.join(privateRoot, 'owner-readonly-http-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(privateRunDirectory, { mode: 0o700 });
  require('@next/env').loadEnvConfig(root, false, { info() {}, error() {} });
  const { createClient } = require('@supabase/supabase-js');
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!project || !serviceKey || !publicKey || publicKey === serviceKey || publicKey.startsWith('sb_secret_')) throw new Error('Distinct public and privileged project configuration is required');
  service = createClient(project, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const owner = await service.auth.admin.getUserById(grant.userId);
  check('Exact owner identity matches the privately authorized mailbox before session minting', !owner.error && owner.data.user?.email?.toLowerCase() === authorization.authorizedMailbox.toLowerCase());
  report.auth.privateMailboxVerified = true;
  const member = await service.from('organization_members').select('organization_id,status,role:roles(name),organization:organizations(name)').eq('organization_id', organizationId).eq('user_id', grant.userId).single();
  const role = Array.isArray(member.data?.role) ? member.data.role[0] : member.data?.role;
  const organization = Array.isArray(member.data?.organization) ? member.data.organization[0] : member.data?.organization;
  check('The exact authorized company membership is active administrator access', !member.error && member.data.status === 'active' && ['owner', 'admin'].includes(role?.name) && organization?.name === 'MENARAPRO');
  const subscription = await readScoped('organization_subscriptions', 'plan_code,status,trial_ends_at,trial_end');
  check('The authorized owner company already has the granted valid PRO evaluation', subscription.length === 1 && subscription[0].plan_code === 'premium' && subscription[0].status === 'trialing' && Date.parse(subscription[0].trial_ends_at || subscription[0].trial_end) > Date.now());
  beforeFinance = await fingerprint();
  const work = await requests();
  report.plannedRequests = work.length;
  checkpoint();
  const generated = await service.auth.admin.generateLink({ type: 'magiclink', email: authorization.authorizedMailbox });
  check('An owner session token is generated without dispatching email', !generated.error && Boolean(generated.data?.properties?.hashed_token));
  const { createServerClient } = require('@supabase/ssr');
  authenticated = createServerClient(project, publicKey, { auth: { autoRefreshToken: false }, cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll(cookies) { for (const cookie of cookies) if (cookie.options?.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name, cookie.value); },
  } });
  const verified = await authenticated.auth.verifyOtp({ type: 'magiclink', token_hash: generated.data.properties.hashed_token });
  check('The new SSR session belongs only to the exact authorized owner', !verified.error && verified.data.user?.id === grant.userId && verified.data.user?.email?.toLowerCase() === authorization.authorizedMailbox.toLowerCase());
  report.auth.newSessionCreated = true;
  const active = await authenticated.from('organization_members').select('organization_id').eq('user_id', grant.userId).eq('status', 'active').limit(1).maybeSingle();
  check('The application-selected active membership is the expected company', !active.error && active.data?.organization_id === organizationId && jar.size > 0);
  report.auth.activeCompanyVerified = true;
  let cursor = 0;
  async function worker() {
    for (;;) {
      const page = work[cursor++]; if (!page) return;
      try { await requestPage(page); }
      catch { report.pages.push({ route: publicRoute(page.concreteRoute), template: page.route, module: page.module, passed: false, error: 'HTTP_READ_FAILED_OR_TIMED_OUT' }); checkpoint(); }
    }
  }
  await Promise.all([worker(), worker()]);
}
main().catch(error => { report.error = String(error.message).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]').replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '[id]'); }).finally(async () => {
  if (beforeFinance) {
    try {
      const after = await fingerprint();
      report.financialIntegrity = { tablesCompared: financeTables.length, beforeDigest: beforeFinance.digest, afterDigest: after.digest, unchanged: beforeFinance.digest === after.digest, changedTables: financeTables.filter(table => beforeFinance.tables[table] !== after.tables[table]) };
    } catch { report.financialIntegrity = { unchanged: false, error: 'POST_AUDIT_SCOPED_FINGERPRINT_FAILED' }; }
  }
  if (authenticated) {
    try { const signedOut = await authenticated.auth.signOut({ scope: 'local' }); report.auth.localSessionSignedOut = !signedOut.error; } catch { report.auth.localSessionSignedOut = false; }
  }
  report.inProgress = false;
  report.completedAt = new Date().toISOString();
  report.success = !report.error && report.auth.localSessionSignedOut && report.financialIntegrity?.unchanged && report.pages.length === report.plannedRequests && report.pages.every(row => row.passed);
  report.summary = { requested: report.pages.length, passed: report.pages.filter(row => row.passed).length, failed: report.pages.filter(row => !row.passed).length, excludedAutoInitOrAlias: report.exclusions.length, unavailableDetails: report.missingRecords.length };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ success: report.success, ...report.summary, financialIntegrityUnchanged: report.financialIntegrity?.unchanged, localSessionSignedOut: report.auth.localSessionSignedOut, error: report.error || null }));
  if (!report.success) process.exitCode = 1;
});
