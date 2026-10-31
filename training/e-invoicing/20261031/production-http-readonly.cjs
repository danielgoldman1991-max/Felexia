/* eslint-disable @typescript-eslint/no-require-imports -- Explicitly gated production read-only QA. */
// No business POST, RPC mutation, document generation, settings update or email.
// --ready-confirmed is supplied only after the owner confirms deployment READY.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createServerClient } = require('@supabase/ssr');

if (!process.argv.includes('--ready-confirmed')) throw Error('Explicit production READY and QA activation confirmation required before any request');
const artifactId = process.argv.find(value => value.startsWith('--artifact='))?.slice(11) || null;
const issuedCheck = process.argv.includes('--issued-check');
const resumeFinances = issuedCheck && process.argv.includes('--resume-finances');
if (artifactId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(artifactId)) throw Error('Exact archive UUID required');
const root = path.resolve(__dirname, '../../..');
const output = path.join(__dirname, issuedCheck ? 'production-issued-http.json' : artifactId ? 'production-http-archive-check.json' : 'production-http-readonly.json');
const base = 'https://www.felexia.pro';
const allowedAppOrigins = new Set([base, 'https://felexia.pro']);
const checks = [], requestLog = [];
const assertCheck = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const assertEqual = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const decode = html => html.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const visible = html => decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const forms = html => [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)].map(match => ({ attributes: match[1], body: match[2] }));
const mutationForms = html => forms(html).filter(form => /\bmethod=["']post["']/i.test(form.attributes) || /\$ACTION_(?:ID|REF)_/.test(form.body));
const removedBanner = 'UBL 2.1 générique préparatoire. La connexion officielle DGI et la signature électronique qualifiée sont indisponibles. Une simulation n’est pas une transmission officielle.';

async function main() {
  let preceding = null;
  if (resumeFinances) {
    preceding = JSON.parse(await fs.readFile(path.join(__dirname, 'production-issued-http-initial.json'), 'utf8'));
    assert(preceding.passed === false && preceding.checks === 168 && preceding.error.startsWith('Electronic issuance does not alter commercial source status'), 'Resume only the recorded harness source-status expectation failure');
  }
  const environment = {};
  for (const line of (await fs.readFile(path.join(root, '.env.local'), 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].includes(match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    environment[match[1]] = value;
  }
  const supabase = new URL(environment.NEXT_PUBLIC_SUPABASE_URL);
  const key = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert(supabase.protocol === 'https:' && supabase.hostname.endsWith('.supabase.co') && !supabase.port && key, 'Configured existing production Supabase required');
  const fixture = JSON.parse(await fs.readFile(path.resolve(root, '../backups/essential-fixes-e2e-private.json'), 'utf8'));
  const organizationId = fixture.organizationId;
  assert(/^[a-f0-9-]{36}$/i.test(organizationId));
  let authLogins = 0;
  async function restrictedFetch(url, options = {}) {
    const target = new URL(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url);
    const method = (options.method ?? 'GET').toUpperCase();
    const authLogin = target.origin === supabase.origin && target.pathname === '/auth/v1/token' && target.searchParams.get('grant_type') === 'password' && method === 'POST';
    const dataRead = target.origin === supabase.origin && ['GET', 'HEAD'].includes(method) && (target.pathname.startsWith('/rest/v1/') || target.pathname === '/auth/v1/user' || target.pathname === '/auth/v1/.well-known/jwks.json');
    const appRead = allowedAppOrigins.has(target.origin) && ['GET', 'HEAD'].includes(method);
    if (!authLogin && !dataRead && !appRead) throw Error('Request outside the authorized QA login and read-only production scope');
    if (authLogin) authLogins++;
    const response = await fetch(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(35000) });
    requestLog.push({ surface: target.origin === supabase.origin ? 'Supabase' : 'Felexia production', method, path: target.pathname, status: response.status });
    return response;
  }
  const sessions = {};
  for (const [role, account] of Object.entries(fixture.users)) {
    if (!['admin', 'operator', 'viewer'].includes(role)) continue;
    if (resumeFinances && role !== 'admin') continue;
    const jar = new Map();
    const sdk = createServerClient(supabase.origin, key, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: entries => { for (const entry of entries) jar.set(entry.name, entry.value); } }, global: { fetch: restrictedFetch } });
    const signed = await sdk.auth.signInWithPassword({ email: account.email, password: account.password });
    if (signed.error || signed.data.user?.id !== account.id) throw Error(`Existing QA ${role} authentication failed; no credentials printed`);
    const membership = await sdk.from('organization_members').select('status,role:roles(name)').eq('organization_id', organizationId).eq('user_id', account.id).limit(1).maybeSingle();
    assert.ifError(membership.error);
    assertEqual(`${role} uses its actual active QA membership`, membership.data?.status, 'active');
    assertEqual(`${role} effective role is read from production membership`, membership.data?.role?.name, role);
    sessions[role] = { sdk, jar };
  }
  assertEqual('The authorized QA roles for this pass are available', Object.keys(sessions).sort(), resumeFinances ? ['admin'] : ['admin', 'operator', 'viewer']);
  async function http(role, location) {
    const identity = role ? sessions[role] : null;
    const url = new URL(location, base);
    assert(allowedAppOrigins.has(url.origin), 'Only the production app receives its own SSR cookies');
    const response = await restrictedFetch(url, { headers: identity ? { cookie: [...identity.jar].map(([name, value]) => `${name}=${value}`).join('; '), 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' } });
    if (identity) for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0], point = pair.indexOf('=');
      if (point > 0) identity.jar.set(pair.slice(0, point), pair.slice(point + 1));
    }
    return response;
  }
  async function page(role, location, { adminOnly = false } = {}) {
    const requestedPath = new URL(location, base).pathname;
    let redirectedAway = false;
    let response = await http(role, location);
    for (let index = 0; [301, 302, 303, 307, 308].includes(response.status) && index < 3; index++) {
      const destination = new URL(response.headers.get('location'), base);
      assert(allowedAppOrigins.has(destination.origin) && !destination.pathname.startsWith('/login'), 'Authenticated QA app session remains available');
      if (destination.pathname !== requestedPath) redirectedAway = true;
      response = await http(role, destination.href);
    }
    if (adminOnly && role !== 'admin' && response.status === 403) { checks.push(`${role} is denied the administrative page by HTTP`); return ''; }
    assertEqual(`${role} page returns200 without a render failure`, response.status, 200);
    const html = await response.text();
    assert(!html.includes('NEXT_HTTP_ERROR_FALLBACK;500'));
    const cache = response.headers.get('cache-control') || '';
    assertCheck('Authenticated module HTML disables shared caching', /no-store/i.test(cache) && !/\bpublic\b|s-maxage=[1-9]/i.test(cache));
    assertCheck('The removed preparatory banner is absent from the normal module page', !visible(html).includes(removedBanner));
    if (adminOnly && role !== 'admin') {
      if (redirectedAway) { checks.push(`${role} administrative route is refused by an authenticated middleware redirect`); return ''; }
      assertCheck(`${role} sees an explicit administrative access refusal`, /réservé[e]?\s+à\s+l['’]administrateur/i.test(visible(html)));
      assertEqual(`${role} administrative page exposes no mutation form`, mutationForms(html).length, 0);
    }
    return html;
  }
  const observations = [];
  for (const role of resumeFinances ? [] : ['admin', 'operator', 'viewer']) {
    const html = await page(role, '/facturation/electronique?lang=fr');
    assertCheck(`${role} reaches the actual electronic-invoicing module`, visible(html).includes('Facturation électronique Maroc'));
    if (role !== 'viewer') assertCheck(`${role} has an active document service`, html.includes('data-service-state="active"') && visible(html).includes('Module actif'));
    else assertEqual('Reader module page contains no mutation form (GET search remains allowed)', mutationForms(html).length, 0);
    await page(role, '/facturation/electronique/configuration?lang=fr', { adminOnly: true });
    await page(role, '/facturation/electronique/supervision?lang=fr', { adminOnly: true });
    observations.push({ role, listLoaded: true, administrativeAccess: role === 'admin' ? 'allowed' : 'refused', businessMutationRequests: 0 });
  }
  let archive = null, financial = null;
  if (artifactId) {
    const meta = await sessions.admin.sdk.from('einvoice_artifacts').select('id,organization_id,document_id,version_id,format,mime_type,sha256,byte_length').eq('organization_id', organizationId).eq('id', artifactId).maybeSingle();
    assert.ifError(meta.error); assert(meta.data, 'Requested artifact belongs to the exact QA tenant');
    const document = await sessions.admin.sdk.from('einvoice_documents').select('id,source_kind,source_id,current_version_id,status,issued_at').eq('organization_id', organizationId).eq('id', meta.data.document_id).maybeSingle();
    assert.ifError(document.error); assert(document.data?.issued_at, 'Archive is attached to an issued document');
    const routeKind = document.data.source_kind === 'invoice' ? 'factures' : 'avoirs';
    const documentPath = `/facturation/electronique/${routeKind}/${document.data.source_id}`;
    const metadata = await sessions.admin.sdk.from('einvoice_artifacts').select('id,version_id,format,mime_type,sha256,byte_length').eq('organization_id', organizationId).eq('document_id', meta.data.document_id).eq('version_id', meta.data.version_id);
    assert.ifError(metadata.error); assertEqual('Issued version retains both document formats', metadata.data.map(item => item.format).sort(), ['pdf', 'xml']);
    const downloads = [];
    for (const role of resumeFinances ? [] : ['admin', 'operator', 'viewer']) {
      const detail = await page(role, `${documentPath}?lang=fr`);
      assertCheck(`${role} sees the issued-and-archived state`, visible(detail).includes('Émise et archivée'));
      assertCheck(`${role} has an explicit PDF download`, visible(detail).includes('Télécharger PDF'));
      if (role === 'viewer') assertEqual('Reader issued detail contains no mutation form', mutationForms(detail).length, 0);
      for (const item of metadata.data) {
        const response = await http(role, `${documentPath}/download?format=${item.format}&version=${item.version_id}`);
        assertEqual(`${role} downloads the issued ${item.format}`, response.status, 200);
        assertEqual('Private archive cache policy is explicit', response.headers.get('cache-control'), 'private, no-store');
        assertEqual('Archive sniffing is disabled', response.headers.get('x-content-type-options'), 'nosniff');
        assertCheck('Archive is a download attachment', (response.headers.get('content-disposition') || '').startsWith('attachment;'));
        const bytes = Buffer.from(await response.arrayBuffer());
        assertEqual('Downloaded byte count equals the immutable SQL metadata', bytes.length, item.byte_length);
        assertEqual('Downloaded SHA256 equals the immutable SQL metadata', sha(bytes), item.sha256);
        if (item.format === 'pdf') assertEqual('Issued PDF download is actual PDF bytes', bytes.subarray(0, 5).toString(), '%PDF-');
        downloads.push({ role, format: item.format, bytes: bytes.length, sha256: item.sha256 });
      }
    }
    if (!resumeFinances) {
      const anonymous = await http(null, `${documentPath}/download?format=pdf&version=${meta.data.version_id}`);
      assertCheck('Anonymous archive download is refused before content is served', [303, 307, 308].includes(anonymous.status) && (anonymous.headers.get('location') || '').includes('/login'));
    }
    archive = { artifactId, documentId: meta.data.document_id, versionId: meta.data.version_id, sourceKind: document.data.source_kind, sourceId: document.data.source_id, issued: true, downloads };
    if (issuedCheck) {
      const foreignOrganizationId = 'c7728100-6e58-46b6-aa07-220b262169ab';
      const foreignSourceId = '0c1d0c3e-7b4e-4e2e-a51e-21fc0f2f4bf1';
      const unknownSourceId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const preview = JSON.parse(await fs.readFile(path.join(__dirname, 'production-http-preview-download.json'), 'utf8'));
      assertEqual('Issuance preserved the exact preview version', preview.versionId, meta.data.version_id);
      assertEqual('Issuance preserved the exact preview PDF', metadata.data.find(item => item.format === 'pdf').sha256, preview.sha256);
      for (const role of resumeFinances ? [] : ['admin', 'operator', 'viewer']) {
        const arabic = await page(role, `${documentPath}?lang=ar`);
        assertCheck(`${role} Arabic detail uses RTL`, /dir="rtl"/.test(arabic));
        if (role === 'viewer') assertEqual('Arabic reader detail has no mutation form', mutationForms(arabic).length, 0);
        for (const item of metadata.data) {
          const response = await http(role, `${documentPath}/download?format=${item.format}&version=${item.version_id}&lang=ar`);
          assertEqual(`${role} Arabic interface downloads frozen ${item.format}`, response.status, 200);
          const bytes = Buffer.from(await response.arrayBuffer());
          assertEqual('Interface language never regenerates an issued archive', sha(bytes), item.sha256);
          assertEqual('Arabic interface archive keeps the private cache policy', response.headers.get('cache-control'), 'private, no-store');
        }
        const inline = await http(role, `${documentPath}/download?format=pdf&version=${meta.data.version_id}&inline=1&lang=fr`);
        assertEqual(`${role} explicit PDF preview is available`, inline.status, 200);
        assertCheck('PDF preview disposition is inline', (inline.headers.get('content-disposition') || '').startsWith('inline;'));
        assertEqual('Inline PDF preview equals frozen archive', sha(Buffer.from(await inline.arrayBuffer())), preview.sha256);
        const legacy = await http(role, `/facturation/factures/${document.data.source_id}/print`);
        assertCheck(`${role} legacy print redirects to the archive`, [303, 307, 308].includes(legacy.status) && (legacy.headers.get('location') || '').startsWith(`${documentPath}/download?`) && (legacy.headers.get('location') || '').includes(`version=${meta.data.version_id}`));
        for (const forbidden of [foreignSourceId, unknownSourceId]) {
          const response = await http(role, `/facturation/electronique/factures/${forbidden}/download?format=pdf&version=${meta.data.version_id}`);
          assertEqual(`${role} foreign or unknown source never returns archive bytes`, response.status, 404);
          assertCheck('Missing-source archive response remains private', (response.headers.get('cache-control') || '').includes('no-store'));
        }
        const foreignRows = await sessions[role].sdk.from('einvoice_documents').select('id').eq('organization_id', foreignOrganizationId).limit(2);
        assert.ifError(foreignRows.error);
        assertEqual(`${role} cannot enumerate another tenant electronic documents`, foreignRows.data, []);
      }
      const read = async (table, fields) => {
        const result = await sessions.admin.sdk.from(table).select(fields).eq('organization_id', organizationId).order('id').limit(1000);
        assert.ifError(result.error);
        assert(result.data.length < 1000, 'Financial fixture does not exceed the requested complete page');
        return result.data;
      };
      const baseline = JSON.parse(await fs.readFile(path.resolve(root, 'training/essential-fixes/20261031/company-final-readonly.json'), 'utf8'));
      const accounts = await read('treasury_accounts', 'id,account_type,current_balance');
      const transactions = await read('treasury_transactions', 'id,direction,transaction_type,amount,archived_at');
      const entries = await read('accounting_entries', 'id,journal_id,status,total_debit,total_credit,source_document_id');
      const journals = await read('accounting_journals', 'id,code');
      const customerPayments = await read('customer_payments', 'id,amount,status,archived_at,cancelled_at');
      const supplierPayments = await read('supplier_payments', 'id,amount,status,archived_at');
      const source = await sessions.admin.sdk.from('customer_invoices').select('id,status,payment_status,subtotal_ht,discount_total,tax_total,total_ttc,paid_amount,remaining_amount,invoice_number').eq('organization_id', organizationId).eq('id', document.data.source_id).single();
      assert.ifError(source.error);
      const version = await sessions.admin.sdk.from('einvoice_versions').select('snapshot').eq('organization_id', organizationId).eq('id', meta.data.version_id).single();
      assert.ifError(version.error);
      for (const [field, snapshotField] of [['subtotal_ht', 'subtotalHt'], ['discount_total', 'discountTotal'], ['tax_total', 'taxTotal'], ['total_ttc', 'totalTtc']]) assertEqual(`Source ${field} still equals its captured pre-issuance value`, Number(source.data[field]), Number(version.data.snapshot.sourceTotals[snapshotField]));
      assertEqual('Source invoice number is unchanged', source.data.invoice_number, version.data.snapshot.number);
      assertEqual('The issued source is the original already-paid Essentiel QA sale', fixture.records.saleId, document.data.source_id);
      assertEqual('The original Essentiel sale retains its paid commercial status', source.data.status, 'paid');
      assertEqual('The original Essentiel sale retains its existing settlements', source.data.paid_amount, 240);
      assertEqual('The original Essentiel sale retains its zero receivable', source.data.remaining_amount, 0);
      const cents = value => Math.round(Number(value) * 100);
      const sum = (rows, field) => rows.reduce((value, row) => value + cents(row[field]), 0) / 100;
      const activeTransactions = transactions.filter(item => !item.archived_at);
      const posted = entries.filter(item => item.status === 'posted');
      financial = {
        bank: sum(accounts.filter(item => item.account_type === 'bank'), 'current_balance'),
        cash: sum(accounts.filter(item => item.account_type === 'cash'), 'current_balance'),
        grossTreasuryIn: sum(activeTransactions.filter(item => item.direction === 'in'), 'amount'),
        grossTreasuryOut: sum(activeTransactions.filter(item => item.direction === 'out'), 'amount'),
        customerReceipts: sum(customerPayments.filter(item => !item.archived_at && !item.cancelled_at && item.status !== 'cancelled'), 'amount'),
        supplierPayments: sum(supplierPayments.filter(item => !item.archived_at && item.status !== 'cancelled'), 'amount'),
        postedEntries: posted.length, totalDebit: sum(posted, 'total_debit'), totalCredit: sum(posted, 'total_credit'),
      };
      for (const [field, actual] of Object.entries(financial)) assertEqual(`Known QA financial baseline is preserved: ${field}`, actual, baseline.financial[field]);
      assertEqual('There are still exactly four real payment cash movements', activeTransactions.filter(item => ['customer_payment', 'supplier_payment'].includes(item.transaction_type)).length, 4);
      assertEqual('There are still exactly four internal transfer movements', activeTransactions.filter(item => ['transfer_in', 'transfer_out'].includes(item.transaction_type)).length, 4);
      for (const expected of baseline.journals) {
        const journal = journals.find(item => item.code === expected.code);
        assert(journal, 'Expected QA journal remains present');
        const rows = posted.filter(item => item.journal_id === journal.id);
        assertEqual(`${expected.code} entry count remains unchanged`, rows.length, expected.entries);
        assertEqual(`${expected.code} debit remains unchanged`, sum(rows, 'total_debit'), expected.debit);
        assertEqual(`${expected.code} credit remains unchanged`, sum(rows, 'total_credit'), expected.credit);
      }
      const emptyTables = ['einvoice_jobs', 'einvoice_transmissions'];
      for (const table of emptyTables) assertEqual(`Documentary issuance creates no ${table}`, (await read(table, 'id')).length, 0);
      archive.interfaceLanguageChecks = ['fr', 'ar'];
      archive.pdfLanguage = 'fr';
      archive.languageNote = 'Arabic UI reads the same immutable French PDF prepared before issuance; no Arabic PDF was generated in production.';
    }
  }
  const results = preceding ? [...preceding.results, ...checks] : checks;
  const report = { passed: true, checkedAt: new Date().toISOString(), nodeVersion: process.version, productionOrigin: base, qaOrganizationId: organizationId, phase: artifactId ? 'issued-archive-readonly' : 'activated-module-readonly', checks: results.length, results, observations, archive, financial, requests: preceding ? [...preceding.requests, ...requestLog] : requestLog, authorizedExistingQaLogins: authLogins + (preceding ? 3 : 0), businessMutationRequests: 0, emailsRequested: 0, notes: ['Only the three explicitly authorized existing QA users were used.', 'Password logins create normal Auth sessions/audit records. Subsequent requests are GET/HEAD only.', 'No mutation form was submitted and no creation, emission, payment, email or configuration action was invoked.', 'Administrative denial can be a403, a middleware redirect away from the requested route, or an inline refusal. The first harness attempt expected only the inline variant; the observed operator redirect was correct.', ...(preceding ? ['The initial168 passing checks are retained from production-issued-http-initial.json. Only the finance section was resumed with one admin login after correcting the harness expectation for the original already-paid sale (not the second open240MAD invoice).', 'The baseline evidence is essential-fixes/20261031/company-final-readonly.json: existing customer allocations240MAD and outstanding0 on the original sale, then0 and240 on the second invoice.'] : []), 'This report contains no passwords, tokens, personal names or email addresses.'] };
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: report.checks, phase: report.phase, roles: observations.map(item => item.role), requests: report.requests.length, businessMutations: 0, authLogins: report.authorizedExistingQaLogins, archiveChecked: !!archive }));
}
main().catch(async error => {
  await fs.writeFile(output, JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), checks: checks.length, results: checks, requests: requestLog, error: error.message, businessMutationRequests: 0, emailsRequested: 0 }, null, 2) + '\n');
  console.error(JSON.stringify({ passed: false, checks: checks.length, error: error.message })); process.exitCode = 1;
});
