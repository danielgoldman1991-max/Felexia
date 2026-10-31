/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS integration-test entry point. */
// Explicitly authorized recovery test for the new recette administrator only.
// Auth/database calls are real. Only the Next request/cookie context is supplied.
// NEVER print credentials, auth links, OTPs, PKCE verifiers or signed cookies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
require('@next/env').loadEnvConfig(root);
const { createClient } = require('@supabase/supabase-js');
const { createActionRunner } = require('./essential-action-runner.cjs');
const manifestArgument = process.argv.find(arg => arg.startsWith('--manifest='))?.slice(11);
const phase = process.argv.find(arg => arg.startsWith('--phase='))?.slice(8);
const usePkce = !process.argv.includes('--token-hash');
if (!manifestArgument || !['request', 'complete'].includes(phase) || !process.argv.includes('--execute-qa')) throw new Error('Explicit private manifest, --phase=request|complete and --execute-qa required');
const manifestPath = path.resolve(manifestArgument);
const privateRoot = path.resolve(root, '../backups') + path.sep;
if (!manifestPath.toLowerCase().startsWith(privateRoot.toLowerCase())) throw new Error('The recovery manifest must remain in the private backups folder outside Git');
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!m.companyName?.startsWith('FELEXIA RECETTE ESSENTIELLE ') || !m.run?.startsWith('essential-final-')) throw new Error('The dedicated recette markers are required');
if (typeof m.authorizedMailbox !== 'string' || !m.authorizedMailbox.includes('@')) throw new Error('An authorized mailbox must be recorded privately');
const [mailboxName, mailboxDomain] = m.authorizedMailbox.toLowerCase().split('@');
for (const role of ['admin', 'operator', 'viewer']) {
  const email = (m.users?.[role]?.email || '').toLowerCase();
  const prefix = mailboxName + '+recette';
  const suffix = role + '@' + mailboxDomain;
  if (!email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length, -suffix.length))) throw new Error('Only the authorized three recette aliases are allowed');
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuid.test(m.organizationId || '') || !uuid.test(m.users.admin.id || '')) throw new Error('Create the dedicated company and administrator before testing recovery');
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!publicUrl || !publicKey || publicKey.startsWith('sb_secret_')) throw new Error('Public Supabase configuration required');
if (publicKey.split('.').length === 3 && JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role !== 'anon') throw new Error('The recovery test requires the public anonymous key');
if (!process.env.RECOVERY_SIGNING_SECRET && !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Recovery signing configuration must exist before sending an email');
const reportDirectory = path.join(root, 'training/essential-fixes/20261031');
fs.mkdirSync(reportDirectory, { recursive: true });
const reportPath = path.join(reportDirectory, 'company-recovery.json');
let previousReport;
try { previousReport = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch { previousReport = null; }
const combined = previousReport?.run === m.run ? previousReport : { run: m.run, companyName: m.companyName, scope: 'Real public Auth and real application recovery functions; Next cookie/request context supplied by fixture adapter', phases: {} };
const report = { date: new Date().toISOString(), phase, success: false, checks: [], diagnostics: [], emailsDispatched: 0 };
m.recoveryState ||= {};
const privateSecrets = new Set(Object.values(m.users).map(user => user.password).filter(Boolean));
for (const value of [m.recoveryLink?.tokenHash, m.recoveryLink?.code, m.recoveryState.candidatePassword, m.recoveryState.authorizationCode, m.recoveryState.pkce?.value]) if (value) privateSecrets.add(value);

function savePrivate() { fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n'); }
function check(name, passed) {
  report.checks.push({ name, passed: Boolean(passed) });
  if (!passed) throw new Error('QA_CHECK_FAILED: ' + name);
}
const jar = new Map();
const cookieContext = {
  get(name) { const item = jar.get(name); return item ? { name, value: item.value } : undefined; },
  getAll() { return [...jar].map(([name, item]) => ({ name, value: item.value })); },
  set(name, value, options = {}) {
    if (typeof name === 'object') { const item = name; jar.set(item.name, { value: item.value, options: item }); }
    else jar.set(name, { value, options });
  },
  delete(name) { jar.delete(typeof name === 'string' ? name : name.name); },
  has(name) { return jar.has(name); },
};
let client;
const runner = createActionRunner(() => client, report.diagnostics, { cookies: cookieContext });

// The SDK stores sessions only in this process. Only the PKCE verifier is saved
// privately between the request and complete commands, to model the same browser.
const volatileStorage = new Map();
const storage = {
  getItem(key) { return key.endsWith('-code-verifier') ? m.recoveryState.pkce?.key === key ? m.recoveryState.pkce.value : null : volatileStorage.get(key) ?? null; },
  setItem(key, value) {
    if (key.endsWith('-code-verifier')) { m.recoveryState.pkce = { key, value }; savePrivate(); }
    else volatileStorage.set(key, value);
  },
  removeItem(key) {
    if (key.endsWith('-code-verifier') && m.recoveryState.pkce?.key === key) { delete m.recoveryState.pkce; savePrivate(); }
    else volatileStorage.delete(key);
  },
};
function newClient(pkce = false) {
  return createClient(publicUrl, publicKey, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: pkce, ...(pkce ? { flowType: 'pkce', storage } : {}) } });
}
function callbackUrl() {
  const base = runner.load('src/lib/app-url.ts').getAppUrl();
  const parsed = new URL(base);
  check('recovery redirects to the public Felexia domain', parsed.protocol === 'https:' && ['felexia.pro', 'www.felexia.pro'].includes(parsed.hostname) && !parsed.port && !parsed.username && !parsed.password);
  const result = new URL('/auth/callback', parsed.origin);
  result.searchParams.set('recovery', '1');
  return result;
}
async function loginWith(password) {
  const current = newClient();
  const signed = await current.auth.signInWithPassword({ email: m.users.admin.email, password });
  return { client: current, signed };
}
async function verifyCompany(current) {
  client = current;
  const workspace = await runner.load('src/lib/auth.ts').getActiveWorkspace();
  check('recovery session retains the dedicated company', workspace?.organization.id === m.organizationId && workspace?.organization.name === m.companyName);
  check('recovery session retains administrator rights', ['owner', 'admin'].includes(workspace?.role));
}
async function requestRecovery() {
  if (m.recoveryState.requestedAt) { report.alreadyRequested = true; check('recovery email was already requested once; no resend', true); return; }
  if (m.recoveryState.dispatchAttemptedAt) throw new Error('RECOVERY_REQUEST_ALREADY_ATTEMPTED_REVIEW_PRIVATE_STATE');
  client = newClient(true);
  const signed = await client.auth.signInWithPassword({ email: m.users.admin.email, password: m.users.admin.password });
  check('administrator authenticates before the recovery request', !signed.error && signed.data.user?.id === m.users.admin.id);
  await verifyCompany(client);
  const redirect = callbackUrl();
  m.recoveryState.redirectTo = redirect.toString();
  m.recoveryState.dispatchAttemptedAt = new Date().toISOString();
  savePrivate();
  const response = await runner.invoke('src/lib/actions/password-recovery.ts', 'requestPasswordRecovery', { email: m.users.admin.email }, { error: null });
  if (response.result?.error) report.actionError = redact(response.result.error);
  check('real recovery action accepts the email dispatch', response.result?.sent === true && response.result?.error === null);
  check('the real request generated a private PKCE verifier', Boolean(m.recoveryState.pkce?.value));
  m.recoveryState.requestedAt = new Date().toISOString();
  report.emailsDispatched = 1;
  savePrivate();
}
async function completeRecovery() {
  if (m.recoveryState.completedAt) {
    const current = await loginWith(m.users.admin.password);
    check('completed recovery still authenticates without a second password change', !current.signed.error && current.signed.data.user?.id === m.users.admin.id);
    await verifyCompany(current.client);return;
  }
  check('recovery request was confirmed before completion', Boolean(m.recoveryState.requestedAt));
  const received = m.recoveryLink;
  check('real recovery email has been received', received?.type === 'recovery' && Boolean(received.tokenHash || received.code));
  const oldPassword = m.users.admin.password;
  m.recoveryState.candidatePassword ||= 'Qa-' + crypto.randomBytes(24).toString('base64url') + '-9a';
  const candidate = m.recoveryState.candidatePassword;
  privateSecrets.add(candidate);
  check('new test password differs from the old password', candidate !== oldPassword);
  savePrivate();
  // Recover safely if a previous invocation lost its final network response.
  if (m.recoveryState.updateAttemptedAt && m.recoveryState.callbackVerifiedAt) {
    const resumed = await loginWith(candidate);
    if (!resumed.signed.error && resumed.signed.data.user?.id === m.users.admin.id) {
      check('a prior uncertain password update is confirmed by public login', true);
      await finishVerification(oldPassword, candidate, resumed.client);
      return;
    }
    throw new Error('RECOVERY_PREVIOUS_UPDATE_UNCONFIRMED_REQUIRES_FRESH_LINK');
  }
  client = newClient(true);
  const target = callbackUrl();
  if (usePkce || received.code) {
    check('PKCE completion has its original private verifier', Boolean(m.recoveryState.pkce?.value));
    let code = received.code ?? m.recoveryState.authorizationCode;
    if (!code) {
      const verify = new URL('/auth/v1/verify', publicUrl);
      verify.searchParams.set('token', received.tokenHash);
      verify.searchParams.set('type', 'recovery');
      verify.searchParams.set('redirect_to', m.recoveryState.redirectTo);
      const verification = await fetch(verify, { redirect: 'manual', headers: { apikey: publicKey } });
      check('real Auth email link returns a recovery redirect', [302, 303, 307].includes(verification.status));
      const location = verification.headers.get('location');
      check('recovery email redirect has a destination', Boolean(location));
      const redirected = new URL(location, publicUrl);
      const requested = new URL(m.recoveryState.redirectTo);
      check('Supabase preserves the configured recovery callback', redirected.origin === requested.origin && redirected.pathname === '/auth/callback' && redirected.searchParams.get('recovery') === '1');
      code = redirected.searchParams.get('code');
      check('real PKCE email verification returns an authorization code', Boolean(code));
      m.recoveryState.authorizationCode = code;
      privateSecrets.add(code);
      savePrivate();
    }
    target.searchParams.set('code', code);
    report.flow = 'PKCE';
  } else {
    target.searchParams.set('type', 'recovery');
    target.searchParams.set('token_hash', received.tokenHash);
    report.flow = 'token_hash';
  }
  const response = await runner.load('src/app/auth/callback/route.ts').GET(new Request(target));
  const destination = response.headers.get('location');
  check('real callback returns the password-reset page', Boolean(destination && new URL(destination).pathname === '/reinitialiser-mot-de-passe'));
  const user = await client.auth.getUser();
  check('received recovery link authenticates the expected administrator', !user.error && user.data.user?.id === m.users.admin.id);
  const proof = jar.get('felexia_recovery');
  check('callback issues a short HttpOnly signed recovery cookie', Boolean(proof?.options.httpOnly && proof.options.sameSite === 'lax' && proof.options.maxAge === 600));
  check('recovery cookie secure flag matches the server environment', proof.options.secure === (process.env.NODE_ENV === 'production'));
  check('real recovery proof validates for the authenticated account', await runner.load('src/lib/auth/recovery-session.ts').canCompletePasswordRecovery(m.users.admin.id));
  m.recoveryState.callbackVerifiedAt = new Date().toISOString();
  m.recoveryState.updateAttemptedAt = new Date().toISOString();
  savePrivate();
  const completed = await runner.invoke('src/lib/actions/password-recovery.ts', 'completePasswordRecovery', { password: candidate, confirmation: candidate }, { error: null });
  if (completed.result?.error) report.actionError = redact(completed.result.error);
  check('real password action completes and returns to login', completed.redirect === '/login?notice=password_updated');
  check('completed password action consumes the recovery cookie', !jar.has('felexia_recovery'));
  const current = await loginWith(candidate);
  check('new password authenticates through public Auth', !current.signed.error && current.signed.data.user?.id === m.users.admin.id);
  await finishVerification(oldPassword, candidate, current.client);
}
async function finishVerification(oldPassword, candidate, authenticatedClient) {
  const obsolete = await loginWith(oldPassword);
  check('old password is refused by public Auth with invalid credentials', obsolete.signed.error?.code === 'invalid_credentials' && !obsolete.signed.data.user);
  await verifyCompany(authenticatedClient);
  const members = await authenticatedClient.from('organization_members').select('user_id,role:roles(name)').eq('organization_id', m.organizationId).eq('status', 'active');
  check('password recovery preserves exactly three active team users', !members.error && members.data?.length === 3);
  for (const role of ['admin', 'operator', 'viewer']) {
    const member = members.data.find(row => row.user_id === m.users[role].id);
    const memberRole = Array.isArray(member?.role) ? member.role[0]?.name : member?.role?.name;
    check('password recovery preserves the ' + role + ' account and role', Boolean(member && (memberRole === role || role === 'admin' && memberRole === 'owner')));
  }
  m.users.admin.password = candidate;
  m.recoveryState.completedAt = new Date().toISOString();
  for (const key of ['candidatePassword', 'authorizationCode', 'pkce']) delete m.recoveryState[key];
  delete m.recoveryLink;
  savePrivate();
}
function redact(value) {
  let result = String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
  for (const secret of privateSecrets) result = result.split(secret).join('[private]');
  return result.replace(/([?&](?:code|token_hash|token|access_token|refresh_token)=)[^\s&]+/gi, '$1[private]').slice(0, 250);
}
async function main() { if (phase === 'request') await requestRecovery(); else await completeRecovery(); report.success = true; }
main().catch(error => {
  report.success = false;
  report.failure = /^QA_CHECK_FAILED:|^RECOVERY_/.test(error?.message ?? '') ? redact(error.message) : 'RECOVERY_FLOW_FAILED';
  process.exitCode = 1;
}).finally(() => {
  report.diagnostics = report.diagnostics.map(redact);
  if (report.alreadyRequested && combined.phases.request?.success) combined.phases.request.lastNoResendCheckAt = report.date;
  else combined.phases[phase] = report;
  combined.date = new Date().toISOString();
  combined.checks = Object.values(combined.phases).flatMap(result => result.checks);
  combined.success = Boolean(combined.phases.request?.success && combined.phases.complete?.success);
  combined.emailsDispatched = m.recoveryState.requestedAt ? 1 : 0;
  combined.status = combined.success ? 'complete' : combined.phases.complete && !combined.phases.complete.success ? 'completion_failed' : combined.phases.request?.success ? 'awaiting_email_completion' : 'incomplete';
  savePrivate();
  fs.writeFileSync(reportPath, JSON.stringify(combined, null, 2) + '\n');
  console.log(JSON.stringify({ phase, success: report.success, checks: report.checks.length, passed: report.checks.filter(item => item.passed).length, emailsDispatched: report.emailsDispatched, failure: report.failure }));
});
