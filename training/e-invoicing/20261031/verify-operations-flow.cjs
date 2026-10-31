/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-Next HTTP integration. */
// This suite never contacts production. Auth/REST transport is a named local test double;
// Next actions, PostgreSQL/RLS, decimal/XML/PDF engines and archive bytes are real.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { createServerClient } = require('@supabase/ssr');
const root = path.resolve(__dirname, '../../..');
const smoke = process.argv.includes('--smoke-build');
const reportPath = path.join(__dirname, smoke ? 'operations-build.json' : 'operations-flow.json');
const results = [];
let requests = 0;
const check = (name, condition) => { assert.ok(condition, name); results.push(name); };
const equal = (name, actual, expected) => { assert.deepEqual(actual, expected, name); results.push(name); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const decode = value => value.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attributes = source => Object.fromEntries([...source.matchAll(/([^\s=<>]+)(?:\s*=\s*"([^"]*)")?/g)].map(match => [match[1], decode(match[2] ?? '')]));
const visible = html => decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
function forms(html) {
  return [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)].map(match => {
    const data = new FormData(), body = match[2];
    for (const input of body.matchAll(/<input\b([^>]*)>/g)) {
      const a = attributes(input[1]);
      if (!a.name || 'disabled' in a || ['checkbox', 'radio'].includes(a.type) && !('checked' in a)) continue;
      data.append(a.name, a.value ?? '');
    }
    for (const select of body.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const a = attributes(select[1]); if (!a.name) continue;
      const options = [...select[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(option => ({ a: attributes(option[1]), text: visible(option[2]) }));
      const option = options.find(item => 'selected' in item.a) || options[0];
      if (option) data.set(a.name, option.a.value ?? option.text);
    }
    return { data, text: visible(body), attributes: attributes(match[1]) };
  });
}
const findForm = (html, predicate) => forms(html).find(form => typeof predicate === 'string' ? form.text.includes(predicate) : predicate(form));
function actionForm(html, predicate) {
  const result = findForm(html, predicate);
  assert(result, `Actual SSR form unavailable: ${typeof predicate === 'string' ? predicate : 'field selector'}`);
  assert([...result.data.keys()].some(key => key.startsWith('$ACTION_')), 'Actual Next action reference is required');
  return result;
}
const issueForm = html => actionForm(html, form => /Émettre/i.test(form.text) && /archiver/i.test(form.text));
const prepareForm = html => actionForm(html, form => form.data.has('lineMetadata'));
const settingsForm = html => actionForm(html, form => form.data.has('expectedRevision'));

async function main() {
  assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Supported Node22 runtime required');
  const manifest = JSON.parse(await fs.readFile(path.resolve(root, '../backups/einvoice-operations-local-private.json'), 'utf8'));
  assert(manifest.localOnly === true && manifest.authSimulated === true && manifest.operations === true);
  assert.equal(manifest.gatewayUrl, 'http://127.0.0.1:55442');
  const base = process.argv.find(value => value.startsWith('--app-url='))?.slice(10) || (smoke ? 'http://localhost:3103' : manifest.appUrl);
  assert(['http://localhost:3104', 'http://localhost:3103'].includes(base));
  const gateway = manifest.gatewayUrl;
  function localFetch(url, options) {
    const origin = new URL(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).origin;
    assert([base, gateway].includes(origin), 'Only the exact isolated origins are permitted');
    requests++;
    return fetch(url, { ...options, signal: AbortSignal.timeout(55000) });
  }
  const identities = {};
  for (const account of manifest.users) {
    const jar = new Map();
    const sdk = createServerClient(gateway, manifest.anonKey, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: entries => { for (const entry of entries) jar.set(entry.name, entry.value); } }, global: { fetch: localFetch } });
    const { error } = await sdk.auth.signInWithPassword({ email: account.email, password: account.password });
    assert.ifError(error);
    identities[account.email.split('@')[0]] = { sdk, jar, account };
  }
  const { admin, operator, viewer, outsider } = identities;
  async function http(identity, location, options = {}) {
    const headers = new Headers(options.headers);
    if (identity) headers.set('cookie', [...identity.jar].map(([name, value]) => `${name}=${value}`).join('; '));
    const response = await localFetch(new URL(location, base), { ...options, headers, redirect: 'manual' });
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0], index = pair.indexOf('=');
      if (index > 0 && identity) identity.jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  async function page(identity, location) {
    let response = await http(identity, location);
    for (let attempt = 0; [301, 302, 303, 307, 308].includes(response.status) && attempt < 3; attempt++) {
      const next = response.headers.get('location'); assert(next && !next.startsWith('/login'), 'Authenticated session must remain active');
      response = await http(identity, next);
    }
    equal('Authenticated real Next page responds200', response.status, 200);
    const html = await response.text();
    assert(!html.includes('NEXT_HTTP_ERROR_FALLBACK;500'), 'No render failure');
    return html;
  }
  async function post(identity, location, form, overrides = {}, errorExpected = false) {
    const body = new FormData();
    for (const [key, value] of form.data) body.append(key, value);
    for (const [key, value] of Object.entries(overrides)) { if (value === null) body.delete(key); else body.set(key, String(value)); }
    const response = await http(identity, location, { method: 'POST', headers: { origin: base }, body });
    if (response.status === 403) return { response, location: null };
    assert([303, 307].includes(response.status), `Server action must redirect (${response.status})`);
    const locationResult = response.headers.get('location'); assert(locationResult);
    if (!errorExpected) assert(!new URL(locationResult, base).searchParams.has('error'), `Action refused: ${new URL(locationResult, base).searchParams.get('error')}`);
    return { response, location: locationResult };
  }
  async function rows(table, filters = {}) {
    let query = admin.sdk.from(table).select('*').eq('organization_id', manifest.ids.organizationId);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    const { data, error } = await query; assert.ifError(error); return data;
  }
  async function hook(name, extra = {}) {
    const response = await localFetch(`${gateway}/__local-test__/${name}`, { method: 'POST', headers: { authorization: `Bearer ${manifest.serviceRoleKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ organizationId: manifest.ids.organizationId, ...extra }) });
    equal('Scoped loopback-only fixture operation succeeds', response.status, 200); return response.json();
  }
  async function configure(overrides) {
    const html = await page(admin, '/facturation/electronique/configuration?lang=fr');
    return post(admin, '/facturation/electronique/configuration?lang=fr', settingsForm(html), { enabled: 'on', connectorMode: 'disabled', buyerType: 'business', preferredLanguage: 'fr', alertsEnabled: 'on', ...overrides });
  }
  const invoicePath = `/facturation/electronique/factures/${manifest.ids.invoiceId}`;
  const creditPath = `/facturation/electronique/avoirs/${manifest.ids.creditNoteId}`;
  const initialInvoiceCount = (await rows('customer_invoices')).length;
  let doc, frenchVersion, arabicVersion;
  if (!smoke) {
    equal('Operations fixture starts with the module genuinely disabled', (await rows('einvoice_settings'))[0].enabled, false);
    const inactive = await page(admin, '/facturation/electronique?lang=fr');
    check('Disabled module does not falsely advertise itself as active', !visible(inactive).includes('Module actif'));
    let config = await page(admin, '/facturation/electronique/configuration?lang=fr');
    const forged = await post(operator, '/facturation/electronique/configuration', settingsForm(config), { enabled: 'on' }, true);
    check('Operator cannot activate the module through a forged admin POST', forged.response.status === 403 || !!new URL(forged.location, base).searchParams.get('error'));
    await configure({ defaultUnitCode: 'HUR' });
    let settings = (await rows('einvoice_settings'))[0];
    equal('Administrator activation actually changes the SQL setting', settings.enabled, true);
    equal('Core workflow stays in the real documents-and-archives mode', settings.connector_mode, 'disabled');
    equal('Administrator-confirmed default unit is persisted', settings.configuration.default_unit_code, 'HUR');
    for (const code of ['C62', 'DAY', 'MON', 'KGM', 'LTR', 'MTR', 'HUR']) await configure({ defaultUnitCode: code });
    equal('All seven supported default units pass the real settings action', (await rows('einvoice_settings'))[0].configuration.default_unit_code, 'HUR');
    const captureBeforeLanguage = await admin.sdk.rpc('einvoice_capture_source', { p_source_kind: 'invoice', p_source_id: manifest.ids.invoiceId }); assert.ifError(captureBeforeLanguage.error);
    await configure({ defaultUnitCode: 'HUR', preferredLanguage: 'ar' });
    for (const location of ['/facturation/electronique', invoicePath, '/facturation/electronique/configuration', '/facturation/electronique/supervision']) {
      check('Saved Arabic language applies to the operational screens', (await page(admin, location)).includes('<div lang="ar" dir="rtl"'));
      check('French query overrides the saved preference', (await page(admin, `${location}?lang=fr`)).includes('<div lang="fr" dir="ltr"'));
    }
    const captureAfterLanguage = await admin.sdk.rpc('einvoice_capture_source', { p_source_kind: 'invoice', p_source_id: manifest.ids.invoiceId }); assert.ifError(captureAfterLanguage.error);
    equal('Language preference does not invalidate fiscal facts', captureAfterLanguage.data.configuration_fingerprint, captureBeforeLanguage.data.configuration_fingerprint);
    await configure({ defaultUnitCode: 'HUR' });
    let html = await page(operator, `${invoicePath}?lang=fr`);
    check('Main document screen has no repeated technical disclaimer', !visible(html).includes('UBL 2.1 générique préparatoire.') && !visible(html).includes('Une simulation n’est pas une transmission officielle.'));
    let preparation = prepareForm(html);
    let metadata = JSON.parse(preparation.data.get('lineMetadata'));
    check('Explicit default unit pre-fills every new document line', metadata.every(line => line.unitCode === 'HUR'));
    const zeroLineId = manifest.ids.invoiceLines.find(line => /^0(?:\.0+)?$/.test(line.tax_rate)).id;
    check('Zero VAT still needs an explicit fiscal category', !metadata.find(line => line.sourceLineId === zeroLineId)?.taxCategory);
    metadata = metadata.map((line, index) => ({ ...line, taxCategory: index === 2 ? 'E' : 'S', exemptionReason: '' }));
    const incomplete = await post(operator, invoicePath, preparation, { buyerType: 'business', lineMetadata: JSON.stringify(metadata) }, true);
    check('Incomplete preparation is never returned as a success', new URL(incomplete.location, base).searchParams.has('error') && !new URL(incomplete.location, base).searchParams.has('notice'));
    doc = (await rows('einvoice_documents', { source_id: manifest.ids.invoiceId }))[0];
    equal('Incomplete preparation is retained as a correctable draft', doc.status, 'draft');
    equal('Incomplete preparation has no falsely valid archive', (await rows('einvoice_artifacts', { document_id: doc.id })).length, 0);
    html = await page(operator, `${invoicePath}?lang=fr`);
    check('Incomplete document cannot be issued from its screen', !findForm(html, form => /Émettre/i.test(form.text) && /archiver/i.test(form.text)));
    preparation = prepareForm(html); metadata = JSON.parse(preparation.data.get('lineMetadata')).map((line, index) => ({ ...line, taxCategory: index === 2 ? 'E' : 'S', exemptionReason: index === 2 ? 'Motif fictif de recette, sans interprétation fiscale.' : '' }));
    const generated = await post(operator, invoicePath, preparation, { buyerType: 'business', lineMetadata: JSON.stringify(metadata), lang: 'fr' });
    equal('Successful generation returns an accurate generated notice', new URL(generated.location, base).searchParams.get('notice'), 'generated');
    doc = (await rows('einvoice_documents', { source_id: manifest.ids.invoiceId }))[0]; frenchVersion = doc.current_version_id;
    const versionCount = (await rows('einvoice_versions', { document_id: doc.id })).length;
    await post(operator, invoicePath, preparation, { buyerType: 'business', lineMetadata: JSON.stringify(metadata), lang: 'fr' });
    equal('Repeated generation reuses its idempotency key', (await rows('einvoice_versions', { document_id: doc.id })).length, versionCount);
    const staleGeneration = await post(operator, invoicePath, preparation, { buyerType: 'business', lineMetadata: JSON.stringify(metadata), lang: 'fr', idempotencyKey: randomUUID() }, true);
    equal('An older form with a different request key remains protected by SQL CAS', new URL(staleGeneration.location, base).searchParams.get('error'), 'EINVOICE_CONFLICT');
    equal('Rejected stale regeneration adds no archive version', (await rows('einvoice_versions', { document_id: doc.id })).length, versionCount);
    html = await page(operator, `${invoicePath}?lang=fr`); const staleIssue = issueForm(html);
    await configure({ defaultUnitCode: 'DAY' });
    const stalePage = await page(operator, `${invoicePath}?lang=fr`);
    check('Changed fiscal settings suppress the issuance action until regeneration', !findForm(stalePage, form => /Émettre/i.test(form.text) && /archiver/i.test(form.text)));
    const refusedStale = await post(operator, invoicePath, staleIssue, {}, true);
    check('A stale issuance form is refused by the real atomic server path', new URL(refusedStale.location, base).searchParams.has('error'));
    equal('Failed atomic issuance rolls back the validation transition', (await rows('einvoice_documents', { id: doc.id }))[0].status, 'draft');
    await configure({ defaultUnitCode: 'HUR' });
    html = await page(admin, `${invoicePath}?lang=fr`); preparation = prepareForm(html);
    await post(admin, invoicePath, preparation, { buyerType: 'business', lineMetadata: JSON.stringify(metadata), lang: 'ar' });
    doc = (await rows('einvoice_documents', { id: doc.id }))[0]; arabicVersion = doc.current_version_id;
    check('French and Arabic generated versions are retained separately', arabicVersion !== frenchVersion);
    html = await page(operator, `${invoicePath}?lang=fr`); const issue = issueForm(html);
    equal('Reader cannot forge the combined issue-and-archive action', (await post(viewer, invoicePath, issue, {}, true)).response.status, 403);
    const issued = await post(operator, invoicePath, issue);
    equal('Combined issuance reports the completed action accurately', new URL(issued.location, base).searchParams.get('notice'), 'issued');
    doc = (await rows('einvoice_documents', { id: doc.id }))[0];
    equal('Operator issues and archives directly without an intermediate user step', doc.status, 'issued');
    await post(operator, invoicePath, issue);
    equal('Repeating the same issuance is idempotent', (await rows('einvoice_documents', { id: doc.id }))[0].current_version_id, arabicVersion);
    equal('Issuance in document mode creates no simulation task', (await rows('einvoice_jobs')).length, 0);
    equal('Document-mode issuance creates no external receipt', (await rows('einvoice_transmissions')).length, 0);
    html = await page(operator, `${creditPath}?lang=fr`); const creditPreparation = prepareForm(html);
    const creditMetadata = JSON.parse(creditPreparation.data.get('lineMetadata')).map(line => ({ ...line, taxCategory: 'S', exemptionReason: '' }));
    await post(operator, creditPath, creditPreparation, { buyerType: 'business', lineMetadata: JSON.stringify(creditMetadata), lang: 'fr' });
    html = await page(operator, `${creditPath}?lang=fr`); await post(operator, creditPath, issueForm(html));
    equal('Customer credit note uses the same two-step documentary workflow', (await rows('einvoice_documents', { source_id: manifest.ids.creditNoteId }))[0].status, 'issued');
    // Exercise administrative tests independently: the real document must stay issued.
    await configure({ defaultUnitCode: 'HUR', connectorMode: 'simulation' });
    const ready = await admin.sdk.rpc('einvoice_transition', { p_document_id: doc.id, p_expected_version: doc.current_version_number, p_target: 'ready_to_submit' }); assert.ifError(ready.error);
    const queued = await admin.sdk.rpc('einvoice_enqueue_simulation', { p_document_id: doc.id, p_expected_version: doc.current_version_number, p_scenario: 'reject', p_idempotency_key: randomUUID() }); assert.ifError(queued.error);
    const supervision = await page(admin, '/facturation/electronique/supervision?lang=fr');
    await post(admin, '/facturation/electronique/supervision', actionForm(supervision, form => /Traiter|Reprendre/.test(form.text)));
    equal('Administrative rejection remains explicitly simulated in SQL', (await rows('einvoice_documents', { id: doc.id }))[0].simulation_status, 'rejected');
    const operationalList = await page(operator, '/facturation/electronique?lang=fr');
    const invoiceRow = [...operationalList.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(match => match[0]).find(row => row.includes(doc.source_number));
    check('A rejected test never replaces the actual issued-and-archived invoice state', /Émise/.test(visible(invoiceRow)) && !/Rejet|Statut inconnu|Simulation interne/.test(visible(invoiceRow)));
    await configure({ defaultUnitCode: 'HUR', connectorMode: 'disabled' });
  } else {
    doc = (await rows('einvoice_documents', { source_id: manifest.ids.invoiceId }))[0];
    const validations = await rows('einvoice_validations', { document_id: doc.id });
    frenchVersion = validations.find(row => row.valid && row.result.pdf_language === 'fr').version_id;
    arabicVersion = validations.find(row => row.valid && row.result.pdf_language === 'ar').version_id;
  }
  equal('Final module remains genuinely active', (await rows('einvoice_settings'))[0].enabled, true);
  equal('Final connector stays in document/archive mode', (await rows('einvoice_settings'))[0].connector_mode, 'disabled');
  for (const identity of [admin, operator, viewer]) {
    const html = await page(identity, `${invoicePath}?lang=fr`);
    check('Issued document has an explicit PDF download distinct from preview', html.includes('format=pdf') && visible(html).includes('Télécharger PDF'));
    check('Main document view avoids the removed prototype banner', !visible(html).includes('UBL 2.1 générique préparatoire.'));
    if (identity === viewer) check('Read-only member sees no document mutation form', !forms(html).length);
    const arabic = await page(identity, `${invoicePath}?lang=ar`);
    check('Arabic document screen retains RTL rendering', arabic.includes('<div lang="ar" dir="rtl"'));
  }
  for (const [language, version] of [['fr', frenchVersion], ['ar', arabicVersion]]) for (const format of ['pdf', 'xml']) {
    const response = await http(viewer, `${invoicePath}/download?format=${format}&version=${version}`);
    equal(`Reader downloads real ${language} ${format} archive`, response.status, 200);
    equal('Private archive response does not enter shared caches', response.headers.get('cache-control'), 'private, no-store');
    const content = Buffer.from(await response.arrayBuffer());
    const meta = (await rows('einvoice_artifacts', { version_id: version, format }))[0];
    equal('Downloaded bytes retain their exact SQL archive hash', sha(content), meta.sha256);
    if (format === 'pdf') equal('Generated archive contains actual PDF bytes', content.subarray(0, 5).toString(), '%PDF-');
    else check('UBL XML contains the exact source TTC', content.toString().includes('<cbc:PayableAmount currencyID="MAD">388.00</cbc:PayableAmount>'));
  }
  const legacy = await http(viewer, `/facturation/factures/${manifest.ids.invoiceId}/print`);
  equal('Usual invoice printing serves the frozen issued PDF', legacy.status, 307);
  check('Usual print targets the exact emitted version', legacy.headers.get('location').includes(arabicVersion));
  equal('Other company cannot download this archive', (await http(outsider, `${invoicePath}/download?format=pdf`)).status, 404);
  const noSession = await http(null, `${invoicePath}/download?format=xml`);
  check('Anonymous archive requests require authentication', [303, 307].includes(noSession.status) && noSession.headers.get('location').includes('/login'));
  const before = (await rows('einvoice_settings'))[0];
  const config = await page(admin, '/facturation/electronique/configuration?lang=fr');
  const official = await post(admin, '/facturation/electronique/configuration', settingsForm(config), { connectorMode: 'official' }, true);
  equal('No hidden form payload can activate a false official connection', new URL(official.location, base).searchParams.get('error'), 'DGI_OFFICIAL_SPECIFICATIONS_UNAVAILABLE');
  const crossOrigin = await http(admin, '/facturation/electronique/configuration', { method: 'POST', headers: { origin: 'https://external.example.test' }, body: settingsForm(config).data });
  check('Next rejects a foreign-origin mutation', crossOrigin.status >= 400);
  equal('Denied payloads leave configuration revision intact', (await rows('einvoice_settings'))[0].revision, before.revision);
  if (!smoke) {
    await hook('subscription-state', { state: 'expired' });
    try {
      equal('Expired subscription retains archive reading', (await http(viewer, `${invoicePath}/download?format=pdf`)).status, 200);
      const capabilities = await viewer.sdk.rpc('einvoice_get_capabilities', { p_organization_id: manifest.ids.organizationId }); assert.ifError(capabilities.error);
      equal('Installed workflow capability stays readable after subscription expiration', capabilities.data, { workflow_version: 2, atomic_issuance: true });
      const denied = await post(admin, '/facturation/electronique/configuration', settingsForm(config), {}, true);
      check('Expired subscription cannot reactivate or mutate the module', denied.response.status === 403 || new URL(denied.location, base).searchParams.has('error'));
    } finally { await hook('subscription-state', { state: 'restore' }); }
  }
  equal('Electronic actions never create duplicate accounting entries', (await rows('accounting_entries')).length, 0);
  equal('Electronic actions preserve the commercial invoice count', (await rows('customer_invoices')).length, initialInvoiceCount);
  const report = { passed: true, date: new Date().toISOString(), nodeVersion: process.version, applicationOrigin: base, checks: results.length, requests, migration102Sha256: manifest.migrationSha256, migration103Sha256: manifest.operationsMigrationSha256, freshDatabase: !smoke, results, scope: { next: 'Actual HTTP SSR pages, multipart Server Actions and download routes', auth: 'Explicit local HS256 test double with actual Supabase SSR SDK', database: 'Real isolated PostgreSQL/PGlite with actual migrations and RLS', finalConnectorMode: 'disabled (document/archive mode)', actualTaxTransmissions: 0, productionAccess: false, newCommercialNumber: false } };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: results.length, requests, phase: smoke ? 'optimized-operations-build' : 'operations-workflow' }));
}
main().catch(async error => {
  await fs.writeFile(reportPath, JSON.stringify({ passed: false, date: new Date().toISOString(), checks: results.length, requests, error: error.message, results, productionAccess: false }, null, 2) + '\n');
  console.error(JSON.stringify({ passed: false, checks: results.length, error: error.message })); process.exitCode = 1;
});
