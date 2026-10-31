/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node fixture entry point. */
// Real callback, server actions and HMAC proof; synthetic Auth/cookie boundaries.
// No .env file, project account, network, email or database is accessed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createActionRunner } = require('../../../scripts/essential-action-runner.cjs');
process.env.RECOVERY_SIGNING_SECRET = 'isolated-recovery-fixture-not-a-production-secret';
process.env.NEXT_PUBLIC_APP_URL = 'https://www.felexia.pro';
const results = [];
function check(value, name) { assert.ok(value, name); results.push(name); }
const user = { id: '00000000-0000-4000-8000-000000000001' };
let currentUser = user;
let resetError = null;
let updateError = null;
let exchangeError = null;
let dispatched = 0;
let updated = 0;
let exchanged = 0;
let verifiedOtp = 0;
let signedOut = 0;
let requestedRedirect;
const jar = new Map();
const cookies = {
  get(name) { const item = jar.get(name); return item ? { name, value: item.value } : undefined; },
  set(name, value, options) { jar.set(name, { value, options }); },
  delete(name) { jar.delete(name); },
};
const client = { auth: {
  async resetPasswordForEmail(_email, options) { dispatched++; requestedRedirect = options.redirectTo; return { error: resetError }; },
  async getUser() { return { data: { user: currentUser }, error: null }; },
  async exchangeCodeForSession(code) { assert.equal(code, 'fixture-code'); exchanged++; return { data: { user: exchangeError ? null : user }, error: exchangeError }; },
  async verifyOtp(input) { assert.equal(input.type, 'recovery'); assert.equal(input.token_hash, 'fixture-token-hash'); verifiedOtp++; return { data: { user }, error: null }; },
  async updateUser(input) { assert.equal(input.password, 'Fixture-password-123'); updated++; return { error: updateError }; },
  async signOut(input) { assert.equal(input.scope, 'local'); signedOut++; currentUser = null; return { error: null }; },
} };
const runner = createActionRunner(() => client, [], { cookies: async () => cookies });
const actionPath = 'src/lib/actions/password-recovery.ts';
const request = email => runner.invoke(actionPath, 'requestPasswordRecovery', { email }, { error: null });
const complete = (password = 'Fixture-password-123', confirmation = password) => runner.invoke(actionPath, 'completePasswordRecovery', { password, confirmation }, { error: null });
const callback = query => runner.load('src/app/auth/callback/route.ts').GET(new Request('https://www.felexia.pro/auth/callback?' + query));
const proof = runner.load('src/lib/auth/recovery-session.ts');

async function main() {
  check((await request('invalid')).result.error && dispatched === 0, 'Invalid email never reaches Auth');
  const known = await request('known@example.test');
  const unknown = await request('unknown@example.test');
  check(JSON.stringify(known) === JSON.stringify(unknown) && known.result.sent, 'Known and unknown accounts receive the same non-enumerating response');
  check(requestedRedirect === 'https://www.felexia.pro/auth/callback?recovery=1', 'Recovery uses the existing public allowlisted callback');
  resetError = { status: 429, code: 'over_email_send_rate_limit' };
  check(/Patientez/.test((await request('fixture@example.test')).result.error), 'Auth rate limiting returns a readable retry message');
  resetError = { status: 500, code: 'smtp_transport_error' };
  check(!(await request('fixture@example.test')).result.sent, 'Mail-provider failure never claims an email was dispatched');
  resetError = null;
  check((await complete('short')).result.error && updated === 0, 'Password shorter than twelve characters is rejected before Auth');
  check((await complete('abcdefghijklmnop')).result.error && updated === 0, 'Password must contain a digit');
  check((await complete('Fixture-password-123', 'Different-password-456')).result.error && updated === 0, 'Password confirmation must match');
  currentUser = null;
  check(/expiré/.test((await complete()).result.error) && updated === 0, 'Unauthenticated session cannot reset a password');
  currentUser = user;
  check(/expiré/.test((await complete()).result.error) && updated === 0, 'Ordinary authenticated session without recovery proof cannot reset a password');
  await callback('recovery=1');
  check(!jar.has('felexia_recovery') && exchanged === 0, 'A recovery URL without a code never creates proof');
  await callback('recovery=1&error=access_denied&code=fixture-code');
  check(!jar.has('felexia_recovery') && exchanged === 0, 'Provider error never exchanges a code or creates proof');
  exchangeError = { code: 'invalid_grant' };
  await callback('recovery=1&code=fixture-code');
  check(!jar.has('felexia_recovery'), 'Invalid or expired Auth code never creates recovery proof');
  exchangeError = null;
  const response = await callback('recovery=1&code=fixture-code');
  check(response.status === 307 && new URL(response.headers.get('location')).pathname === '/reinitialiser-mot-de-passe', 'Real callback redirects to the reset page');
  const valid = jar.get('felexia_recovery');
  check(valid.options.httpOnly && valid.options.sameSite === 'lax' && valid.options.path === '/' && valid.options.maxAge === 600, 'Callback sets a short HttpOnly signed proof cookie');
  check(valid.options.secure === (process.env.NODE_ENV === 'production'), 'Cookie transport policy matches the server environment');
  check(await proof.canCompletePasswordRecovery(user.id), 'The real signed proof validates for the recovered account');
  currentUser = { id: '00000000-0000-4000-8000-000000000002' };
  check(/expiré/.test((await complete()).result.error) && updated === 0, 'Recovery proof cannot reset another account');
  currentUser = user;
  jar.set('felexia_recovery', { ...valid, value: valid.value.slice(0, -1) + (valid.value.endsWith('0') ? '1' : '0') });
  check(/expiré/.test((await complete()).result.error) && updated === 0, 'A tampered signed proof cannot reset the password');
  jar.set('felexia_recovery', valid);
  updateError = { code: 'same_password' };
  check(/différent/.test((await complete()).result.error) && signedOut === 0 && jar.has('felexia_recovery'), 'Auth same-password rejection retains proof and session for correction');
  updateError = { code: 'unexpected_failure' };
  check((await complete()).result.error && signedOut === 0 && jar.has('felexia_recovery'), 'Failed Auth write cannot claim a completed password change');
  updateError = null;
  const success = await complete();
  check(success.redirect === '/login?notice=password_updated', 'Successful real action redirects to login with confirmation');
  check(signedOut === 1 && !jar.has('felexia_recovery'), 'Successful change consumes proof and signs out the local session');
  currentUser = user;
  const before = updated;
  check((await complete()).result.error && updated === before, 'Consumed recovery proof cannot be replayed by an authenticated session');
  await callback('type=recovery&token_hash=fixture-token-hash');
  check(verifiedOtp === 1 && await proof.canCompletePasswordRecovery(user.id), 'The supported token-hash callback also requires real Auth verification');
  const legacyRunner = createActionRunner(() => client);
  check(legacyRunner.load('src/lib/auth/sanitize-internal-path.ts').sanitizeInternalPath('//foreign.example') === '/dashboard', 'Runner remains compatible without request-cookie options');
  fs.writeFileSync(path.join(__dirname, 'recovery-action-tests.json'), JSON.stringify({ success: true, checks: results.length, scope: 'Real server actions/callback/proof; synthetic Auth and cookies; zero network or emails', results }, null, 2) + '\n');
  console.log(JSON.stringify({ success: true, checks: results.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
