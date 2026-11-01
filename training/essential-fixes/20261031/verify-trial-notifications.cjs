/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real-source notification fixtures. */
// No .env, credentials, production database, email or cron invocation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const { AuthSessionMissingError, AuthInvalidJwtError, AuthApiError, AuthRetryableFetchError } = require('@supabase/auth-js');
const root = path.resolve(__dirname, '../../..');
const moduleCache = new Map();
const fakeProcess = { env: {} };
const results = [];
let fixture;
function check(value, name) { assert.ok(value, name); results.push(name); }
function reset(options = {}) {
  fixture = { subscriptions: [], notifications: [], apiCap: 37, inserts: 0, serviceCalls: 0, subscriptionReads: 0, ...options };
  fakeProcess.env.CRON_SECRET = options.secret;
}
function subscription(org = 'company', status = 'trialing', overrides = {}) {
  return { id: org + '-subscription', organization_id: org, plan_code: 'essentiel', status, created_at: '2026-01-01T00:00:00Z', trial_end: null, trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(), current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(), ...overrides };
}
function query(table) {
  let fields, insert, offset = 0, end = Infinity, limit = Infinity;
  const filters = [], orders = [];
  function evaluate() {
    if (table === 'organization_subscriptions') {
      fixture.subscriptionReads++;
      if (fixture.subscriptionError) return { data: null, error: { code: 'fixture_unavailable', message: 'Private fixture detail' } };
    }
    if (insert) {
      if (fixture.insertError || Number.isInteger(fixture.failInsertAfter) && fixture.inserts >= fixture.failInsertAfter) return { data: null, error: { code: 'fixture_unavailable' } };
      if (fixture.notifications.some(row => row.id === insert.id)) return { data: null, error: { code: '23505' } };
      fixture.inserts++;
      fixture.notifications.push({ id: 'created-' + fixture.inserts, created_at: new Date().toISOString(), ...insert });
      return { data: null, error: null };
    }
    if (table === 'app_notifications' && (fixture.notificationReadError || fields === '*' && fixture.notificationListError)) return { data: null, error: { code: 'fixture_unavailable' } };
    if (table === 'app_notifications' && fields === 'id,type,metadata' && fixture.activateDuringDedup) {
      fixture.activateDuringDedup = false;
      fixture.subscriptions[0].status = 'active';
    }
    if (table === 'app_notifications' && fields === 'id,type,metadata' && fixture.dedupBarrier) {
      fixture.dedupBarrier.remaining--;
      if (fixture.dedupBarrier.remaining === 0) fixture.dedupBarrier.release();
      return fixture.dedupBarrier.wait.then(() => ({ data: [], error: null }));
    }
    let rows = table === 'organization_subscriptions' ? fixture.subscriptions
      : table === 'app_notifications' ? fixture.notifications
        : table === 'organization_members' ? [{ organization_id: 'company', user_id: 'fixture-user', status: 'active' }] : [];
    rows = rows.filter(row => filters.every(filter => filter(row)));
    for (const [key, ascending] of [...orders].reverse()) rows = [...rows].sort((a, b) => (String(a[key]).localeCompare(String(b[key]))) * (ascending ? 1 : -1));
    return { data: rows.slice(offset, Math.min(end + 1, offset + fixture.apiCap, offset + limit)), error: null };
  }
  const q = {
    select(value) { fields = value; return q; },
    eq(key, value) { filters.push(row => row[key] === value); return q; },
    in(key, values) { filters.push(row => values.includes(row[key])); return q; },
    gte(key, value) { filters.push(row => row[key] >= value); return q; },
    lt(key, value) { filters.push(row => row[key] < value); return q; },
    order(key, options) { orders.push([key, options.ascending]); return q; },
    limit(value) { limit = value; return q; },
    range(from, to) { offset = from; end = to; return q; },
    insert(value) { insert = value; return q; },
    async maybeSingle() { const result = await evaluate(); return { ...result, data: result.data?.[0] ?? null }; },
    then(yes, no) { return Promise.resolve(evaluate()).then(yes, no); },
  };
  return q;
}
const db = { from: query, auth: { getUser: async () => ({ data: { user: fixture.anonymous || fixture.authError ? null : { id: 'fixture-user' } }, error: fixture.authError || null }) } };
function load(file) {
  const absolute = path.isAbsolute(file) ? file : path.join(root, file);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const state = { exports: {} }; moduleCache.set(absolute, state);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module: state, exports: state.exports, process: fakeProcess, Date, URL, Response, console: { error() {} }, require(name) {
    if (name === '@/lib/supabase/server') return { createClient: async () => db };
    if (name === '@/lib/supabase/service') return { createClient: () => { fixture.serviceCalls++; return db; } };
    if (name === '@/lib/auth') return { requireActiveWorkspace: async () => { throw Error('Notifications never need an invented workspace'); } };
    if (name === 'next/cache') return { revalidatePath() {} };
    if (name === 'next/server') return require('next/server');
    if (name === 'node:crypto') return require('node:crypto');
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(absolute), name) + '.ts');
    throw Error('Unexpected fixture dependency: ' + name);
  } }, { filename: absolute });
  return state.exports;
}
const reminders = load('src/lib/notifications/trial.ts');
const cron = load('src/app/api/cron/trial-notifications/route.ts');
const api = load('src/app/api/notifications/route.ts');
function cronRequest(bearer) { return new NextRequest('https://www.felexia.pro/api/cron/trial-notifications', { headers: bearer ? { authorization: 'Bearer ' + bearer } : {} }); }
async function main() {
  reset(); let response = await cron.GET(cronRequest());
  check(response.status === 503 && fixture.serviceCalls === 0 && fixture.inserts === 0, 'Missing server secret fails closed before any service access');
  reset({ secret: 'isolated-secret' }); response = await cron.GET(cronRequest('wrong'));
  check(response.status === 401 && fixture.serviceCalls === 0 && fixture.inserts === 0 && response.headers.get('cache-control') === 'no-store', 'Wrong bearer is refused before any read or mutation');
  reset({ subscriptions: [subscription()] });
  const created = await reminders.generateTrialNotificationForOrg('company', { client: db });
  check(created === 'created' && fixture.notifications[0].type !== 'trial_expired' && fixture.notifications[0].metadata.trial_end === fixture.subscriptions[0].trial_ends_at, 'Canonical trial_ends_at wins when legacy trial_end is null');
  check(await reminders.generateTrialNotificationForOrg('company', { client: db }) === 'skipped' && fixture.inserts === 1, 'Repeated generation does not duplicate the same reminder');
  const previousReminder = fixture.notifications[0];
  fixture.subscriptions[0].trial_ends_at = new Date(Date.now() + 6 * 86400000).toISOString();
  check(await reminders.generateTrialNotificationForOrg('company', { client: db }) === 'created' && fixture.inserts === 2, 'A changed same-day expiry creates the current-state reminder');
  const updatedCanonical = await load('src/lib/subscriptions/plan-access.ts').getOrganizationSubscription('company', { client: db });
  check(!reminders.isCurrentTrialNotification(previousReminder, updatedCanonical), 'An earlier expiry state is excluded from the visible reminders');
  const legacyReminder = { ...fixture.notifications[1], metadata: { kind: 'trial_reminder', date: new Date().toISOString().slice(0, 10), days_left: 6 } };
  check(!reminders.isCurrentTrialNotification(legacyReminder, updatedCanonical), 'Legacy metadata without the subscription/expiry state is hidden');
  reset({ subscriptions: [subscription()] });
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  fixture.dedupBarrier = { remaining: 2, wait, release };
  const concurrent = await Promise.all([reminders.generateTrialNotificationForOrg('company', { client: db }), reminders.generateTrialNotificationForOrg('company', { client: db })]);
  check(concurrent.includes('created') && concurrent.includes('skipped') && fixture.inserts === 1 && fixture.notifications.length === 1, 'Concurrent empty dedup reads still produce one primary-key-protected notification');
  reset({ subscriptions: [subscription('company', 'trialing', { trial_end: new Date(Date.now() - 86400000).toISOString() })] });
  await reminders.generateTrialNotificationForOrg('company', { client: db });
  check(fixture.notifications[0].type !== 'trial_expired', 'Canonical future date also overrides an expired legacy date');
  reset({ subscriptions: [subscription('company', 'trialing', { trial_end: null, trial_ends_at: null })] });
  check(await reminders.generateTrialNotificationForOrg('company', { client: db }) === 'skipped' && fixture.inserts === 0, 'A missing trial date never invents an expired trial');
  reset({ subscriptions: [subscription('company', 'active')] });
  check(await reminders.generateTrialNotificationForOrg('company', { client: db }) === 'skipped' && fixture.inserts === 0, 'A current paid active subscription never receives a trial reminder');
  reset({ subscriptions: [subscription()], activateDuringDedup: true });
  check(await reminders.generateTrialNotificationForOrg('company', { client: db }) === 'skipped' && fixture.inserts === 0, 'Activation during the batch is re-read before insertion');
  for (const flag of ['subscriptionError', 'notificationReadError', 'insertError']) {
    reset({ subscriptions: [subscription()], [flag]: true });
    await assert.rejects(() => reminders.generateTrialNotificationForOrg('company', { client: db }));
    check(fixture.inserts === 0, flag + ' is propagated without claiming an inserted notification');
  }
  reset({ secret: 'isolated-secret', subscriptions: Array.from({ length: 83 }, (_, i) => subscription('company-' + String(i).padStart(3, '0'))) });
  response = await cron.GET(cronRequest('isolated-secret')); let body = await response.json();
  check(response.status === 200 && body.generated === 83 && fixture.inserts === 83, 'Cron paginates beyond the 37-row fixture API cap and counts only successful inserts');
  reset({ secret: 'isolated-secret', subscriptions: [subscription('company', 'trialing', { created_at: '2025-01-01T00:00:00Z' }), subscription('company', 'active', { id: 'new-paid', created_at: '2026-02-01T00:00:00Z' })] });
  response = await cron.GET(cronRequest('isolated-secret')); body = await response.json();
  check(response.status === 200 && body.generated === 0 && fixture.inserts === 0, 'Even a legacy duplicate candidate cannot override the canonical latest paid subscription');
  reset({ secret: 'isolated-secret', subscriptions: [subscription('company', 'active')] });
  response = await cron.GET(cronRequest('isolated-secret')); body = await response.json();
  check(response.status === 200 && body.generated === 0 && fixture.subscriptionReads === 1, 'Active companies are skipped at candidate enumeration without per-company reads');
  for (const flag of ['subscriptionError', 'notificationReadError', 'insertError']) {
    reset({ secret: 'isolated-secret', subscriptions: [subscription()], [flag]: true });
    response = await cron.GET(cronRequest('isolated-secret')); body = await response.json();
    check(response.status === 503 && body.generated === 0 && !JSON.stringify(body).includes('Private'), 'Cron ' + flag + ' never returns a false success or count');
  }
  reset({ secret: 'isolated-secret', subscriptions: [subscription('company-a'), subscription('company-b')], failInsertAfter: 1 });
  response = await cron.GET(cronRequest('isolated-secret')); body = await response.json();
  check(response.status === 503 && body.generated === 1 && fixture.inserts === 1, 'A partially failed batch reports only the successful insertion and a failure status');
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date(today + 'T23:59:59.750Z');
  reset({ subscriptions: [subscription()] });
  const canonical = await load('src/lib/subscriptions/plan-access.ts').getOrganizationSubscription('company', { client: db });
  const expected = reminders.buildCurrentTrialNotification(canonical, now);
  fixture.notifications.push({ organization_id: 'company', type: expected.type, created_at: today + 'T23:59:59.500Z', metadata: { ...expected.metadata, subscription_id: canonical.id, subscription_status: canonical.status, trial_end: canonical.trialEndsAt } });
  check(await reminders.generateTrialNotificationForOrg('company', { client: db, now }) === 'skipped' && fixture.inserts === 0, 'Half-open next-day boundary includes the final fractional second of the day');
  reset({ subscriptions: [subscription('company', 'active')], notifications: [
    ...Array.from({ length: 70 }, (_, i) => ({ id: 'stale-' + i, organization_id: 'company', type: 'trial_expired', metadata: { kind: 'trial_reminder', date: today }, created_at: '2026-10-31T00:00:00Z' })),
    ...Array.from({ length: 65 }, (_, i) => ({ id: 'business-' + i, organization_id: 'company', type: 'invoice_validated', metadata: {}, created_at: '2026-01-01T00:00:00Z' })),
    { id: 'foreign', organization_id: 'other-company', type: 'invoice_validated', metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  ] });
  response = await api.GET(); body = await response.json();
  check(response.status === 200 && body.total === 65 && body.notifications.length === 50 && body.notifications.every(row => row.type === 'invoice_validated' && row.organization_id === 'company'), 'Paid account hides obsolete reminders while retaining full paginated business notifications');
  check(fixture.notifications.length === 136 && fixture.inserts === 0, 'Obsolete reminder exclusion preserves historical rows without database deletion');
  reset({ subscriptions: [subscription('company', 'active')], notificationListError: true }); response = await api.GET();
  check(response.status === 503 && response.headers.get('cache-control') === 'private, no-store', 'Notification API exposes a readable failure instead of an empty false success');
  reset({ anonymous: true }); response = await api.GET();
  check(response.status === 401 && fixture.inserts === 0, 'Anonymous notification read never creates a reminder');
  for (const authError of [new AuthSessionMissingError(), new AuthInvalidJwtError('Isolated invalid token'), new AuthApiError('Isolated expired session', 401, 'session_expired'), new AuthApiError('Isolated missing user', 404, 'user_not_found')]) {
    reset({ authError }); response = await api.GET();
    check(response.status === 401 && fixture.inserts === 0 && response.headers.get('cache-control') === 'private, no-store', 'Real SDK missing/invalid/expired session error returns401: ' + authError.name + '/' + (authError.code || authError.status));
  }
  for (const authError of [new AuthRetryableFetchError('Isolated unavailable Auth', 0), new AuthApiError('Isolated Auth outage', 503, 'unexpected_failure'), new AuthApiError('Isolated Auth rate limit', 429, 'over_request_rate_limit')]) {
    reset({ authError }); response = await api.GET();
    check(response.status === 503 && fixture.inserts === 0, 'Real SDK Auth service failure remains503: ' + authError.name + '/' + authError.status);
  }
  const quoteNow = new Date('2026-11-01T12:00:00.000Z');
  for (const code of ['pro', 'premium']) for (const days of [0, 2, 6, 14]) {
    const end = new Date(quoteNow.getTime() + days * 86400000).toISOString();
    const notification = reminders.buildTrialNotification('trialing', end, days, quoteNow, code);
    check(notification.action_label === 'Demander un devis' && notification.action_url.startsWith('mailto:') && notification.metadata.offer_mode === 'quote', 'PRO access reminder uses quote contact for ' + code + '/' + days + ' days');
    check(!/payer|essai gratuit/i.test(notification.title + ' ' + notification.message + ' ' + notification.action_label), 'PRO access reminder never advertises self-service payment or a public free trial');
  }
  for (const status of ['canceled', 'past_due', 'unpaid']) {
    const notification = reminders.buildTrialNotification(status, null, 0, quoteNow, 'premium');
    check(notification.action_label === 'Demander un devis' && notification.action_url.startsWith('mailto:'), 'Inactive PRO contract uses quote contact: ' + status);
  }
  check(reminders.buildTrialNotification('active', null, 0, quoteNow, 'premium') === null, 'Active PRO contract never receives an access-expiry reminder');
  check(reminders.buildTrialNotification('trialing', '2026-11-03T12:00:00.000Z', 2, quoteNow).action_label === 'Payer maintenant', 'Existing four-argument Essentiel reminder signature and payment action remain compatible');
  reset({ subscriptions: [subscription()] });
  await reminders.generateTrialNotificationForOrg('company', { client: db });
  const oldEssential = fixture.notifications[0];
  fixture.subscriptions[0].plan_code = 'premium';
  check(await reminders.generateTrialNotificationForOrg('company', { client: db }) === 'created' && fixture.inserts === 2, 'Same-day Essentiel-to-PRO activation creates a distinct quote reminder without overwriting history');
  const proCanonical = await load('src/lib/subscriptions/plan-access.ts').getOrganizationSubscription('company', { client: db });
  check(!reminders.isCurrentTrialNotification(oldEssential, proCanonical) && reminders.isCurrentTrialNotification(fixture.notifications[1], proCanonical), 'Stale payment CTA is excluded after PRO activation and only current quote CTA remains visible');
  response = await api.GET(); body = await response.json();
  check(body.notifications.length === 1 && body.notifications[0].action_label === 'Demander un devis' && fixture.inserts === 2, 'Notification API exposes quote CTA and creates no duplicate on read');
  fs.writeFileSync(path.join(__dirname, 'trial-notification-tests.json'), JSON.stringify({ success: true, checks: results.length, scope: 'Real cron, API, generator and canonical subscription loader; deterministic API fixture cap37; zero network or production data', results }, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, checks: results.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
