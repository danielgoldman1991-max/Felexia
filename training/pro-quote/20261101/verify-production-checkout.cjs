/* eslint-disable @typescript-eslint/no-require-imports -- authorized existing-QA production guard probes */
// Never follows Checkout, opens a portal, creates/expires a Stripe session,
// confirms payment, sends email, changes a plan or invokes cron/DGI.
// Only explicitly forbidden POST payloads are probed after quote-only publication.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "../../..");
const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const EXPECTED_ORG = "1eabead7-02ca-4d44-b147-2831d8799eaa";
const EXPECTED_RUN = "essential-final-20261031202921";
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  return value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
}
const hash = value => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
function validateManifest(m) {
  if (m.organizationId !== EXPECTED_ORG || m.run !== EXPECTED_RUN || m.companyName !== "FELEXIA RECETTE ESSENTIELLE 20261031202921") throw Error("QUOTE_PROBE_QA_SCOPE_MISMATCH");
  const [mailbox, domain] = String(m.authorizedMailbox ?? "").toLowerCase().split("@");
  if (!mailbox || !domain) throw Error("QUOTE_PROBE_MAILBOX_MARKER_REQUIRED");
  for (const role of ["admin", "operator", "viewer"]) {
    const account = m.users?.[role]; const email = String(account?.email ?? "").toLowerCase();
    const prefix = `${mailbox}+recette`; const suffix = `${role}@${domain}`;
    if (!email.startsWith(prefix) || !email.endsWith(suffix) || !/^\d+$/.test(email.slice(prefix.length, -suffix.length)) || !account?.password || !/^[0-9a-f-]{36}$/i.test(account.id ?? "")) throw Error("QUOTE_PROBE_QA_ALIAS_MISMATCH");
  }
}
function privatePath(filename) {
  const base = fs.realpathSync(path.resolve(root, "../backups"));
  const target = fs.existsSync(filename) ? fs.realpathSync(path.resolve(filename)) : path.join(fs.realpathSync(path.dirname(path.resolve(filename))), path.basename(filename));
  const relative = path.relative(base, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw Error("QUOTE_PROBE_PRIVATE_PATH_REQUIRED");
  return target;
}
function probeCases() {
  const probes = [];
  for (const role of ["admin", "operator", "viewer"]) for (const planCode of ["pro", "premium"]) for (const billingInterval of ["monthly", "yearly", "invalid"]) {
    probes.push({ role, planCode, billingInterval, expectedStatus: role === "admin" ? 400 : 403, ...(role === "admin" ? { expectedCode: "PRO_QUOTE_REQUIRED" } : {}) });
  }
  for (const billingInterval of ["monthly", "yearly", "invalid"]) probes.push({ role: "admin", planCode: "business", billingInterval, expectedStatus: 400, expectedError: "PLAN_NOT_AVAILABLE" });
  return probes;
}
function visible(html) { return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/[\s\u00a0\u202f]+/g, " "); }
async function main() {
  const manifestPath = privatePath(arg("manifest") ?? path.resolve(root, "../backups/essential-fixes-e2e-private.json"));
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8")); validateManifest(m);
  const origin = arg("origin") ?? "https://www.felexia.pro";
  if (!["https://www.felexia.pro", "http://localhost:3112"].includes(origin)) throw Error("QUOTE_PROBE_ORIGIN_NOT_ALLOWED");
  if (!process.argv.includes("--execute-quote-guards")) {
    console.log(JSON.stringify({ action: "plan-only", origin, existingSyntheticQaOnly: true, probes: probeCases().length,
      expectedProAdmin: "400 PRO_QUOTE_REQUIRED", expectedOperatorViewer: 403, expectedBusiness: "400 PLAN_NOT_AVAILABLE",
      compareContractAndCustomer: true, stripeReadsOnly: true, stripeMutations: 0, paymentsEmailsPlanChangesCronDgi: 0 })); return;
  }
  require("@next/env").loadEnvConfig(root);
  const { createServerClient } = require("@supabase/ssr");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey || publicKey.startsWith("sb_secret_") || publicKey === process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error("QUOTE_PROBE_PUBLIC_AUTH_REQUIRED");
  const clients = {}; const jars = {};
  const report = { date: new Date().toISOString(), origin, success: false,
    scope: "Real forbidden checkout POST probes on the existing synthetic QA company, three independent public Auth sessions; no Checkout navigation or Stripe mutation",
    checks: [], probes: [], stripeMutations: 0, planChanges: 0, paymentsEmailsCronDgi: 0, authSessionsSignedOut: {} };
  const output = path.join(__dirname, origin.startsWith("https:") ? "production-checkout-guards.json" : "host-checkout-guards.json");
  const privateSnapshot = privatePath(path.resolve(root, `../backups/pro-quote-guard-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
  const state = { marker: "felexia-pro-quote-guards-20261101", organizationId: EXPECTED_ORG, run: EXPECTED_RUN, origin, date: report.date };
  const check = (name, passed) => { report.checks.push({ name, passed: Boolean(passed) }); if (!passed) throw Error(`QUOTE_PROBE_CHECK_FAILED_${name.replace(/[^a-z0-9]+/gi, "_")}`); };
  let stripe;
  if (process.env.STRIPE_SECRET_KEY) { const Stripe = require("stripe"); stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 1 }); }
  async function contract() {
    const [organization, subscription] = await Promise.all([
      clients.admin.from("organizations").select("id,name,stripe_customer_id").eq("id", EXPECTED_ORG).single(),
      clients.admin.from("organization_subscriptions").select("*").eq("organization_id", EXPECTED_ORG).limit(2),
    ]);
    if (organization.error || organization.data?.name !== m.companyName || subscription.error || subscription.data?.length !== 1) throw Error("QUOTE_PROBE_CONTRACT_SCOPE_READ_FAILED");
    return { organization: organization.data, subscription: subscription.data[0] };
  }
  async function stripeSnapshot(customerId) {
    if (!customerId) return { available: true, customerPresent: false, openSessions: [], subscriptions: [] };
    if (!stripe) return { available: false, reason: "Stripe read credential not available" };
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || customer.metadata?.organization_id !== EXPECTED_ORG) throw Error("QUOTE_PROBE_STRIPE_CUSTOMER_SCOPE_MISMATCH");
    const [sessions, subscriptions] = await Promise.all([
      stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 }),
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }),
    ]);
    if (sessions.has_more || subscriptions.has_more) throw Error("QUOTE_PROBE_STRIPE_PAGINATION_REVIEW_REQUIRED");
    return { available: true, customerPresent: true,
      openSessions: sessions.data.map(item => ({ id: item.id, mode: item.mode, status: item.status, created: item.created, expires_at: item.expires_at, metadata: item.metadata })).sort((a, b) => a.id.localeCompare(b.id)),
      subscriptions: subscriptions.data.map(item => ({ id: item.id, status: item.status, cancel_at_period_end: item.cancel_at_period_end,
        items: item.items.data.map(line => ({ id: line.id, price: line.price.id, quantity: line.quantity })) })).sort((a, b) => a.id.localeCompare(b.id)),
    };
  }
  try {
    const published = await fetch(`${origin}/pricing`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
    const publishedText = visible(await published.text());
    check("quote_only_pricing_is_published_before_POST_probes", published.status === 200 && /sur devis/i.test(publishedText) && !/\b(?:1\s?290|12\s?900)\b/.test(publishedText));
    for (const role of ["admin", "operator", "viewer"]) {
      const jar = new Map(); jars[role] = jar;
      const client = createServerClient(url, publicKey, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: values => { for (const cookie of values) if (cookie.options?.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name, cookie.value); } }, auth: { autoRefreshToken: false, detectSessionInUrl: false } });
      clients[role] = client;
      const signed = await client.auth.signInWithPassword({ email: m.users[role].email, password: m.users[role].password });
      check(`${role}_public_Auth_is_exact_prepared_QA_account`, !signed.error && signed.data.user?.id === m.users[role].id && jar.size > 0);
      const memberships = await client.from("organization_members").select("organization_id,role:roles(name)").eq("user_id", signed.data.user.id).eq("status", "active");
      const member = memberships.data?.[0]; const currentRole = Array.isArray(member?.role) ? member.role[0]?.name : member?.role?.name;
      check(`${role}_membership_and_company_match_QA`, !memberships.error && memberships.data?.length === 1 && member.organization_id === EXPECTED_ORG && (role === "admin" ? ["admin", "owner"].includes(currentRole) : currentRole === role));
    }
    state.before = await contract(); state.stripeBefore = await stripeSnapshot(state.before.organization.stripe_customer_id ?? state.before.subscription.stripe_customer_id);
    fs.writeFileSync(privateSnapshot, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    for (const item of probeCases()) {
      const response = await fetch(`${origin}/api/stripe/checkout`, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(30000),
        headers: { Origin: origin, "Content-Type": "application/json", Cookie: [...jars[item.role]].map(([name, value]) => `${name}=${value}`).join("; ") },
        body: JSON.stringify({ planCode: item.planCode, billingInterval: item.billingInterval }) });
      const body = await response.json().catch(() => null);
      const passed = response.status === item.expectedStatus && (!item.expectedCode || body?.code === item.expectedCode) && (!item.expectedError || body?.error === item.expectedError) && !body?.url;
      report.probes.push({ ...item, status: response.status, code: typeof body?.code === "string" ? body.code : null, returnedUrl: Boolean(body?.url), passed });
    }
    state.after = await contract(); state.stripeAfter = await stripeSnapshot(state.after.organization.stripe_customer_id ?? state.after.subscription.stripe_customer_id);
    fs.writeFileSync(privateSnapshot, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    check("all_forbidden_payloads_are_refused_without_redirect", report.probes.every(item => item.passed));
    check("exact_QA_contract_and_customer_mapping_unchanged", hash(state.before) === hash(state.after));
    report.contractShaBefore = hash(state.before); report.contractShaAfter = hash(state.after);
    if (state.stripeBefore.available && state.stripeAfter.available) {
      check("Stripe_open_sessions_and_subscriptions_unchanged", hash(state.stripeBefore) === hash(state.stripeAfter));
      report.stripeReadVerification = { available: true, openSessionsBefore: state.stripeBefore.openSessions.length, openSessionsAfter: state.stripeAfter.openSessions.length,
        subscriptionsBefore: state.stripeBefore.subscriptions.length, subscriptionsAfter: state.stripeAfter.subscriptions.length,
        shaBefore: hash(state.stripeBefore), shaAfter: hash(state.stripeAfter) };
    } else report.stripeReadVerification = { available: false, limitation: "No Stripe read credential available; contract/customer mapping still verified" };
    report.success = true;
  } catch (error) {
    report.failure = /^QUOTE_/.test(error.message ?? "") ? error.message : "QUOTE_PRODUCTION_GUARD_VERIFICATION_FAILED";
  } finally {
    if (clients.admin && state.before && !state.after) {
      try { state.after = await contract(); state.stripeAfter = await stripeSnapshot(state.after.organization.stripe_customer_id ?? state.after.subscription.stripe_customer_id); fs.writeFileSync(privateSnapshot, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 }); report.contractUnchangedAfterFailure = hash(state.before) === hash(state.after); }
      catch { report.finalSnapshotUnavailable = true; }
    }
    for (const [role, client] of Object.entries(clients)) {
      try { report.authSessionsSignedOut[role] = !(await client.auth.signOut({ scope: "local" })).error; } catch { report.authSessionsSignedOut[role] = false; }
    }
    report.completedAt = new Date().toISOString(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ success: report.success, probes: report.probes.length, failed: report.probes.filter(item => !item.passed),
      checks: report.checks.length, failure: report.failure, output }));
    if (!report.success) process.exitCode = 1;
  }
}
module.exports = { validateManifest, probeCases };
if (require.main === module) main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message ?? "") ? error.message : "QUOTE_PROBE_PREPARATION_FAILED"); process.exitCode = 1; });
