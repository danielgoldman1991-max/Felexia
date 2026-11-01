/* eslint-disable @typescript-eslint/no-require-imports -- Explicitly authorized production QA harness. */
// Prepares real Checkout sessions for the NEW fictitious QA company only.
// NEVER follows Checkout URLs, confirms a payment, supplies a card, creates a
// paying subscription, or expires a session belonging to another company/run.
// Stripe references, URLs, credentials and original billing snapshots stay private.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const argument = process.argv.find(value => value.startsWith('--manifest='))?.slice(11);
if (!argument || !process.argv.includes('--execute-qa')) throw new Error('Explicit private manifest and --execute-qa required');
const manifestPath = fs.realpathSync(path.resolve(argument));
const privateRoot = fs.realpathSync(path.resolve(root, '../backups')) + path.sep;
if (!manifestPath.toLowerCase().startsWith(privateRoot.toLowerCase())) throw new Error('Private backups manifest required');
let m;
try { m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { throw new Error('Private manifest unavailable or malformed'); }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!m.run?.startsWith('essential-final-') || !m.companyName?.startsWith('FELEXIA RECETTE ESSENTIELLE ') || !uuid.test(m.organizationId || '')) throw new Error('The exact new recette company markers are required');
if (typeof m.authorizedMailbox !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(m.authorizedMailbox)) throw new Error('Authorized mailbox must be recorded privately');
const [mailboxName, mailboxDomain] = m.authorizedMailbox.toLowerCase().split('@');
for (const role of ['admin', 'operator', 'viewer']) {
  const account = m.users?.[role];
  const prefix = mailboxName + '+recette'; const suffix = role + '@' + mailboxDomain;
  const email = (account?.email || '').toLowerCase();
  if (!email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length, -suffix.length)) || !uuid.test(account?.id || '') || !account.password) throw new Error('Only the exact three prepared QA users are allowed');
}
require('@next/env').loadEnvConfig(root);
const { createServerClient } = require('@supabase/ssr');
const Stripe = require('stripe');
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!publicUrl || !publicKey || publicKey.startsWith('sb_secret_') || !stripeKey) throw new Error('Public Auth and local Stripe verification configuration required');
if (publicKey.split('.').length === 3 && JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role !== 'anon') throw new Error('Public anonymous Auth key required');
const stripe = new Stripe(stripeKey, { timeout: 15000, maxNetworkRetries: 1 });
const verificationContext = process.argv.find(value => value.startsWith('--verification-context='))?.slice(23);
const requestedOrigin = process.argv.find(value => value.startsWith('--origin='))?.slice(9);
if (verificationContext && !['price-chat-local', 'price-chat-production'].includes(verificationContext)) throw new Error('Unsupported QA verification context');
if (requestedOrigin && verificationContext !== 'price-chat-local') throw new Error('A custom origin requires the exact local QA context');
const origin = requestedOrigin || 'https://www.felexia.pro';
const parsedOrigin = new URL(origin);
if (verificationContext === 'price-chat-local' && (!requestedOrigin || parsedOrigin.origin !== origin || parsedOrigin.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsedOrigin.hostname) || Number(parsedOrigin.port) < 1024)) throw new Error('Only an explicit localhost QA origin is supported');
const returnOrigin = 'https://felexia.pro';
const jar = new Map();
const auth = createServerClient(publicUrl, publicKey, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: values => { for (const value of values) { if (value.value) jar.set(value.name, value.value); else jar.delete(value.name); } },
  },
  auth: { autoRefreshToken: false, detectSessionInUrl: false },
});
const report = { date: new Date().toISOString(), run: m.run, companyName: m.companyName, verificationContext: verificationContext || 'historical-production', origin, success: false, checks: [], http: [], cleanup: { attempted: false, completed: false }, scope: 'Real HTTP Checkout preparation and read-only Stripe verification; no Checkout navigation, card, confirmation, paying subscription or charge' };
const startedAt = Math.floor(Date.now() / 1000);
const sessionIds = new Set();
let customerId = null;
let originalSubscription = null;
let canDiscoverNewSessions = false;
const directory = verificationContext ? path.join(root, 'training/price-chat/20261101', verificationContext === 'price-chat-local' ? 'billing-checkout-local' : 'billing-checkout-production') : path.join(root, 'training/essential-fixes/20261031');
fs.mkdirSync(directory, { recursive: true });
try {
  const previous = JSON.parse(fs.readFileSync(path.join(directory, 'company-billing-checkout.json'), 'utf8'));
  if (previous.run === m.run) report.previousAttempts = [...(previous.previousAttempts || []), {
    date: previous.date, success: previous.success, http: previous.http, cleanup: previous.cleanup,
    localTrialUnchanged: previous.localTrialUnchanged, noFunds: previous.noFunds, failure: previous.failure,
    ...(previous.failure === 'QA_CHECK_FAILED: monthly returns only to production billing settings' ? { diagnosis: 'Harness expected www; canonical production return origin is the valid HTTPS apex Felexia domain' } : {}),
  }];
} catch { /* First authorized run has no prior sanitized report. */ }
function check(name, passed) { report.checks.push({ name, passed: Boolean(passed) }); if (!passed) throw new Error('QA_CHECK_FAILED: ' + name); }
function savePrivate() {
  const current = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (current.run !== m.run || current.organizationId !== m.organizationId) throw new Error('PRIVATE_MANIFEST_SCOPE_CHANGED');
  current.billingCheckout = m.billingCheckout;
  const temporary = manifestPath + '.billing-' + process.pid + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(current, null, 2) + '\n');
  fs.renameSync(temporary, manifestPath);
}
async function read(query, name) { const result = await query; check(name, !result.error && result.data !== null); return result.data; }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stableSubscription = row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updated_at').sort(([a], [b]) => a.localeCompare(b)));
async function company() {
  const row = await read(auth.from('organizations').select('id,name,created_at,stripe_customer_id').eq('id', m.organizationId).single(), 'Public administrator can read the exact QA company');
  check('Checkout targets the manifest company name and identifier', row.id === m.organizationId && row.name === m.companyName);
  check('Company is newly created for this QA run', Date.parse(row.created_at) <= Date.now() + 60000 && Date.now() - Date.parse(row.created_at) < 48 * 3600000);
  return row;
}
async function subscription() {
  const rows = await read(auth.from('organization_subscriptions').select('*').eq('organization_id', m.organizationId).order('created_at', { ascending: false }).limit(2), 'Public administrator can read the QA subscription');
  check('Company has exactly one local subscription', rows.length === 1);
  return rows[0];
}
async function verifyCustomer(id) {
  const customer = await stripe.customers.retrieve(id);
  check('Stripe customer belongs only to this fictitious QA organization', !customer.deleted && customer.metadata.organization_id === m.organizationId && customer.name === m.companyName && customer.email?.toLowerCase() === m.users.admin.email.toLowerCase());
  return customer;
}
async function verifyNoFunds(stage) {
  if (!customerId) return;
  await verifyCustomer(customerId);
  const [subscriptions, charges, intents, methods] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 }),
    stripe.charges.list({ customer: customerId, limit: 100 }),
    stripe.paymentIntents.list({ customer: customerId, limit: 100 }),
    stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 100 }),
  ]);
  check(stage + ': no Stripe subscription was created', !subscriptions.has_more && subscriptions.data.length === 0);
  check(stage + ': no charge or payment intent exists', !charges.has_more && !intents.has_more && charges.data.length === 0 && intents.data.length === 0);
  check(stage + ': no card was attached', !methods.has_more && methods.data.length === 0);
}
async function currentCustomer() {
  const row = await company();
  if (row.stripe_customer_id) {
    if (customerId) check('QA Stripe customer reference remains stable', row.stripe_customer_id === customerId);
    customerId = row.stripe_customer_id;
    await verifyCustomer(customerId);
    m.billingCheckout.customerId = customerId;
    savePrivate();
  }
  return customerId;
}
async function remember(session) {
  check('Discovered Checkout session belongs to this QA organization', session.customer === customerId && session.mode === 'subscription' && session.metadata?.organization_id === m.organizationId && session.metadata.plan_code === 'essentiel');
  sessionIds.add(session.id);
  m.billingCheckout.sessionIds = [...sessionIds];
  savePrivate();
  return session;
}
async function prepare(interval) {
  canDiscoverNewSessions = true;
  const response = await fetch(origin + '/api/stripe/checkout', {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(45000),
    headers: { 'content-type': 'application/json', accept: 'application/json', origin, cookie: [...jar].map(([name, value]) => name + '=' + value).join('; ') },
    body: JSON.stringify({ planCode: 'essentiel', billingInterval: interval }),
  });
  for (const line of response.headers.getSetCookie?.() || []) {
    const pair = line.split(';', 1)[0]; const separator = pair.indexOf('=');
    if (separator > 0) { const name = pair.slice(0, separator), value = pair.slice(separator + 1); if (value) jar.set(name, value); else jar.delete(name); }
  }
  let payload;
  try { payload = await response.json(); } catch { throw new Error('PRODUCTION_CHECKOUT_NON_JSON_RESPONSE'); }
  report.http.push({ interval, status: response.status, destination: payload.destination || null });
  if (response.status === 503) {
    report.blocker = /^La souscription est momentanément indisponible/.test(payload.error || '') ? 'PRODUCTION_STRIPE_CONFIGURATION_MISSING' : /^Ce tarif est momentanément indisponible/.test(payload.error || '') ? 'PRODUCTION_PRICE_CONFIGURATION_MISSING' : 'PRODUCTION_CHECKOUT_PREPARATION_FAILED';
    throw new Error(report.blocker);
  }
  check(interval + ' production HTTP prepares a Checkout rather than a portal', response.status === 200 && payload.destination === 'checkout' && typeof payload.url === 'string');
  const target = new URL(payload.url);
  check('Returned Checkout URL is a secure Stripe URL and is never opened', target.protocol === 'https:' && target.hostname === 'checkout.stripe.com' && !target.username && !target.password);
  const id = target.pathname.match(/cs_(?:test|live)_[A-Za-z0-9]+/)?.[0];
  check('Returned Checkout URL contains a session reference', Boolean(id));
  await currentCustomer();
  check('Production stores a customer for the new QA company', Boolean(customerId));
  const session = await stripe.checkout.sessions.retrieve(id);
  await remember(session);
  check('Production URL matches the Stripe session URL', session.url === payload.url);
  return session;
}
async function validateSession(session, interval, amount) {
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
  const line = lines.data[0]; const price = line?.price;
  check(interval + ' session uses Essentiel and the requested billing cycle', session.metadata.plan_code === 'essentiel' && session.metadata.billing_cycle === interval);
  check(interval + ' session contains one recurring unit at the expected MAD price', !lines.has_more && lines.data.length === 1 && line.quantity === 1 && price.currency === 'mad' && price.unit_amount === amount && price.recurring?.interval === (interval === 'monthly' ? 'month' : 'year') && price.recurring.interval_count === 1);
  check(interval + ' session uses the current exact configured price ID', price.id === process.env[interval === 'monthly' ? 'STRIPE_PRICE_ESSENTIEL_MONTHLY' : 'STRIPE_PRICE_ESSENTIEL_YEARLY']);
  check(interval + ' total is the exact public tariff', session.currency === 'mad' && session.amount_total === amount);
  check(interval + ' remains open, unpaid and without a subscription or payment', session.status === 'open' && session.payment_status === 'unpaid' && !session.subscription && !session.payment_intent);
  const success = new URL(session.success_url), cancel = new URL(session.cancel_url);
  check(interval + ' returns only to canonical production billing settings', success.origin === returnOrigin && success.pathname === '/parametres/abonnement' && success.searchParams.get('success') === 'true' && success.searchParams.has('session_id') && cancel.origin === returnOrigin && cancel.pathname === '/parametres/abonnement' && cancel.searchParams.get('canceled') === 'true');
}
async function cleanup() {
  report.cleanup.attempted = true;
  await currentCustomer();
  if (!customerId) { report.cleanup.completed = true; report.cleanup.sessionsExpired = 0; return; }
  if (canDiscoverNewSessions) {
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
    check('Cleanup discovery is bounded to this QA customer', !open.has_more);
    for (const session of open.data) if (session.created >= startedAt && session.mode === 'subscription' && session.metadata?.organization_id === m.organizationId) await remember(session);
  }
  let expired = 0;
  for (const id of sessionIds) {
    let session = await stripe.checkout.sessions.retrieve(id);
    check('Cleanup verifies every session tenant before expiring it', session.customer === customerId && session.metadata?.organization_id === m.organizationId && session.mode === 'subscription');
    if (session.status === 'open') { session = await stripe.checkout.sessions.expire(id); expired++; }
    check('Every prepared QA Checkout is expired without completion', session.status === 'expired' && !session.subscription && !session.payment_intent);
  }
  const remaining = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
  check('No Checkout from this QA run remains open', !remaining.has_more && !remaining.data.some(session => sessionIds.has(session.id) || canDiscoverNewSessions && session.created >= startedAt && session.metadata?.organization_id === m.organizationId));
  report.cleanup.completed = true;
  report.cleanup.sessionsExpired = expired;
  report.cleanup.sessionsPrepared = sessionIds.size;
  m.billingCheckout.cleanupCompletedAt = new Date().toISOString();
  savePrivate();
}
async function main() {
  const signed = await auth.auth.signInWithPassword({ email: m.users.admin.email, password: m.users.admin.password });
  check('Public SSR authentication is the exact prepared QA administrator', !signed.error && signed.data.user?.id === m.users.admin.id && signed.data.user?.email?.toLowerCase() === m.users.admin.email.toLowerCase());
  check('Real SSR authentication issued session cookies', jar.size > 0);
  const members = await read(auth.from('organization_members').select('user_id,role:roles(name)').eq('organization_id', m.organizationId).eq('status', 'active'), 'QA membership can be read');
  check('Only the exact three prepared users belong to this QA company', members.length === 3 && members.every(member => Object.values(m.users).some(account => account.id === member.user_id)));
  for (const role of ['admin', 'operator', 'viewer']) {
    const member = members.find(row => row.user_id === m.users[role].id); const actualRole = Array.isArray(member?.role) ? member.role[0]?.name : member?.role?.name;
    check('QA ' + role + ' membership retains its required role', actualRole === role || role === 'admin' && actualRole === 'owner');
  }
  await company(); originalSubscription = await subscription();
  check('Local subscription is the original free Essentiel trial', originalSubscription.status === 'trialing' && originalSubscription.plan_code === 'essentiel' && !originalSubscription.stripe_subscription_id && Date.parse(originalSubscription.trial_ends_at || originalSubscription.trial_end) > Date.now());
  const previous = m.billingCheckout;
  m.billingCheckout = { run: m.run, organizationId: m.organizationId, startedAt: new Date().toISOString(), originalSubscription, sessionIds: [], previousAttempts: previous ? [...(previous.previousAttempts || []), { startedAt: previous.startedAt, sessionIds: previous.sessionIds, customerId: previous.customerId, cleanupCompletedAt: previous.cleanupCompletedAt }] : [] };
  savePrivate();
  await currentCustomer();
  if (customerId) {
    await verifyNoFunds('Before preparation');
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
    check('No pre-existing Checkout is altered by this test', !open.has_more && open.data.length === 0);
  }
  try {
    const monthly = await prepare('monthly'); await validateSession(monthly, 'monthly', 9900);
    const repeated = await prepare('monthly');
    check('A repeated monthly HTTP request reuses exactly the same Checkout', repeated.id === monthly.id);
    const yearly = await prepare('yearly'); await validateSession(yearly, 'yearly', 118800);
    check('Changing the cycle prepares a distinct yearly Checkout', yearly.id !== monthly.id);
    const former = await stripe.checkout.sessions.retrieve(monthly.id);
    check('Production expires the prior monthly Checkout before the cycle change', former.status === 'expired' && !former.subscription);
    report.monthlyAmountMinor = 9900; report.yearlyAmountMinor = 118800; report.currency = 'MAD'; report.sameMonthlySessionReused = true; report.priorMonthlyExpiredByCycleChange = true;
  } finally { await cleanup(); }
  await verifyNoFunds('After cleanup');
  const finalSubscription = await subscription();
  check('The exact local free trial dates and all subscription fields remain unchanged', same(stableSubscription(finalSubscription), stableSubscription(originalSubscription)) && finalSubscription.status === 'trialing' && finalSubscription.plan_code === 'essentiel' && !finalSubscription.stripe_subscription_id);
  report.noFunds = true; report.success = true;
}
main().catch(error => {
  report.success = false;
  report.failure = /^(?:QA_CHECK_FAILED:|PRODUCTION_|PRIVATE_MANIFEST_)/.test(error?.message || '') ? error.message : 'BILLING_CHECKOUT_VERIFICATION_FAILED';
  if (typeof error?.code === 'string' && /^[a-z_]{1,60}$/.test(error.code)) report.providerErrorCode = error.code;
  process.exitCode = 1;
}).finally(async () => {
  if (m.billingCheckout && !report.cleanup.completed) {
    try { await cleanup(); } catch { report.cleanup.completed = false; report.cleanup.requiresAttention = true; }
  }
  if (originalSubscription) {
    try {
      const finalSubscription = await subscription();
      report.localTrialUnchanged = same(stableSubscription(finalSubscription), stableSubscription(originalSubscription));
      check('Final safeguard confirms the original local trial is unchanged', report.localTrialUnchanged);
      if (customerId) { await verifyNoFunds('Final safeguard'); report.noFunds = true; }
    } catch { report.success = false; report.finalSafeguardFailed = true; process.exitCode = 1; }
  }
  report.completedAt = new Date().toISOString();
  if (m.billingCheckout) savePrivate();
  fs.writeFileSync(path.join(directory, 'company-billing-checkout.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, passed: report.checks.filter(item => item.passed).length, http: report.http, cleanup: report.cleanup, localTrialUnchanged: report.localTrialUnchanged, noFunds: report.noFunds, failure: report.failure }));
});
