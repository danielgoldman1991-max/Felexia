/* eslint-disable @typescript-eslint/no-require-imports -- isolated CommonJS fixture loader */
// Executes the real offer config, Stripe helper and checkout route with synthetic
// Stripe/auth/database boundaries. No network, customer, session or charge.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const ts = require(path.join(root, "node_modules/typescript"));
const env = {};
for (const code of ["essentiel", "business", "premium"]) for (const interval of ["monthly", "yearly"]) {
  env[`STRIPE_PRICE_${code.toUpperCase()}_${interval.toUpperCase()}`] = `price_${code}_${interval}`;
}
const org = "10000000-0000-4000-8000-000000000001";
let state;
function reset() {
  state = { workspace: { organization: { id: org, name: "Synthetic QA" }, email: "admin@example.test", role: "admin" },
    configured: true, proCapabilities: { workflow_version: 104, pro_write_guards: true }, capabilityError: null,
    lease: "lease_fixture", customer: "cus_fixture", customerOrganization: org,
    subscriptions: [], sessions: [], linePrice: "price_essentiel_monthly", priceOverride: {},
    calls: { prices: 0, customers: 0, checkouts: [], portals: 0, expired: 0, released: 0 } };
}
const stripe = {
  prices: { retrieve: async id => {
    state.calls.prices++;
    const [, code, interval] = id.split("_");
    const monthly = code === "premium" ? 1290 : code === "business" ? 690 : 290;
    return { id, active: true, type: "recurring", billing_scheme: "per_unit", currency: "mad",
      unit_amount: monthly * (interval === "yearly" ? 10 : 1) * 100,
      recurring: { interval: interval === "yearly" ? "year" : "month", interval_count: 1, usage_type: "licensed" },
      transform_quantity: null, ...state.priceOverride };
  } },
  customers: {
    retrieve: async () => ({ id: state.customer, metadata: { organization_id: state.customerOrganization } }),
    create: async () => { state.calls.customers++; return { id: "cus_created" }; },
  },
  subscriptions: { list: async () => ({ data: state.subscriptions, has_more: false }) },
  checkout: { sessions: {
    list: async () => ({ data: state.sessions, has_more: false }),
    listLineItems: async () => ({ data: [{ price: { id: state.linePrice }, quantity: 1 }], has_more: false }),
    expire: async () => { state.calls.expired++; return {}; },
    create: async body => { state.calls.checkouts.push(body); return { url: "https://checkout.stripe.test/fixture" }; },
  } },
  billingPortal: { sessions: { create: async () => { state.calls.portals++; return { url: "https://billing.stripe.test/fixture" }; } } },
};
const service = {
  async rpc(name) {
    if (name === "claim_billing_checkout") return { data: state.lease, error: null };
    if (name === "release_billing_checkout") { state.calls.released++; return { error: null }; }
    throw Error(`Unexpected RPC ${name}`);
  },
  from() {
    const query = { select() { return query; }, eq() { return query; }, update() { return query; },
      single: async () => ({ data: { stripe_customer_id: state.customer, name: "Synthetic QA" }, error: null }),
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); } };
    return query;
  },
};
const fixtures = {
  "next/server": { NextResponse: { json: (body, { status = 200 } = {}) => ({ body, status }) } },
  "@/lib/auth": { getActiveWorkspace: async () => state.workspace },
  "@/lib/supabase/service": { createClient: () => service },
  "@/lib/supabase/server": { createClient: async () => ({ rpc: async (name, args) => {
    assert.equal(name, "erp_get_capabilities"); assert.equal(args.p_organization_id, org);
    return { data: state.proCapabilities, error: state.capabilityError };
  } }) },
  "server-only": {},
  "@/lib/env": { hasStripeEnv: () => state.configured, getEnv: () => ({ stripeSecretKey: "fixture", appUrl: "https://felexia.test" }) },
  "@/lib/auth/roles": { isAdminRole: role => ["admin", "owner"].includes(role), isOperatorRole: role => role === "operator" },
  "@/lib/auth/operator-access": { OPERATOR_ACCESS_ERROR: "operator denied" },
  stripe: { __esModule: true, default: class { constructor() { return stripe; } } },
};
const cache = new Map();
function moduleAt(relativePath) {
  if (cache.has(relativePath)) return cache.get(relativePath);
  const target = { exports: {} };
  cache.set(relativePath, target.exports);
  const source = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { module: target, exports: target.exports, process: { env }, console: { error() {}, warn() {} },
    require: name => {
      if (fixtures[name]) return fixtures[name];
      if (name.startsWith("@/")) return moduleAt(`src/${name.slice(2)}.ts`);
      throw Error(`Unexpected dependency ${name}`);
    } });
  cache.set(relativePath, target.exports);
  return target.exports;
}
const offers = moduleAt("src/lib/subscriptions/commercial-offers.ts");
const plans = moduleAt("src/lib/subscriptions/plans.ts");
const billing = moduleAt("src/lib/stripe.ts");
const checkout = moduleAt("src/app/api/stripe/checkout/route.ts");
const checks = [];
function ok(condition, label) { assert.equal(condition, true, label); checks.push(label); }
const request = (planCode, billingInterval = "monthly") => ({ json: async () => ({ planCode, billingInterval }) });
const openSession = (code, interval) => ({ id: "cs_fixture", mode: "subscription", url: "https://checkout.stripe.test/open",
  metadata: { organization_id: org, plan_code: code, billing_cycle: interval } });
async function main() {
  ok(offers.filterPubliclyAvailablePlans(plans.SUBSCRIPTION_PLANS).map(p => p.name).join(",") === "Essentiel,PRO", "Exactly ESSENTIEL and PRO are public");
  ok(plans.getPlanDefinition("pro").code === "premium" && plans.getPlanDefinition("premium").name === "PRO", "PRO aliases preserve durable premium code");
  ok(plans.getPlanDefinition("business").name === "Business", "Legacy Business identity is preserved");
  ok(plans.DEFAULT_PLAN_CODE === "essentiel", "New trial/default remains Essentiel");
  ok(plans.getPlanDefinition("premium").moduleKeys.includes("rh"), "PRO includes RH entitlement");
  for (const bad of [null, undefined, "", "business", "unknown", "Premium", {}, 1]) {
    reset(); ok(offers.resolvePublicPlanCode(bad) === null, `Explicit public resolver rejects ${JSON.stringify(bad)}`);
    ok((await checkout.POST(request(bad))).status === 400 && state.calls.prices === 0, "Invalid public input has no billing action");
  }
  for (const role of [null, "viewer", "operator"]) {
    reset(); if (role === null) state.workspace = null; else state.workspace.role = role;
    ok((await checkout.POST(request("pro"))).status === (role === null ? 401 : 403), "Checkout enforces authentication/admin role");
    ok(state.calls.checkouts.length === 0 && state.calls.prices === 0, "Unauthorized request has no Stripe calls");
  }
  for (const code of ["essentiel", "premium", "pro"]) for (const interval of ["monthly", "yearly"]) {
    reset(); const response = await checkout.POST(request(code, interval));
    const canonical = code === "pro" ? "premium" : code;
    const body = state.calls.checkouts[0];
    ok(response.status === 200 && body.line_items[0].price === `price_${canonical}_${interval}`, `${code} ${interval} selects correct configured Price`);
    ok(body.metadata.plan_code === canonical && body.subscription_data.metadata.plan_code === canonical, "Session and subscription metadata use durable plan code");
    ok(!("trial_period_days" in body.subscription_data) && !("trial_end" in body.subscription_data), "Checkout cannot grant a PRO trial");
    ok(state.calls.released === 1, "Checkout lease released after success");
  }
  for (const capabilities of [null, {}, { workflow_version: 103, pro_write_guards: true }, { workflow_version: 104, pro_write_guards: false }]) {
    reset(); state.proCapabilities = capabilities;
    ok((await checkout.POST(request("pro"))).body.code === "PRO_ACTIVATION_PENDING", "Missing/incomplete SQL capability blocks PRO purchase");
    ok(state.calls.prices === 0 && state.calls.customers === 0 && state.calls.checkouts.length === 0, "Capability failure has no Stripe calls");
  }
  reset(); state.capabilityError = { code: "PGRST202" };
  ok((await checkout.POST(request("premium"))).status === 503, "RPC failure blocks PRO purchase");
  reset(); state.proCapabilities = null;
  ok((await checkout.POST(request("essentiel"))).status === 200, "Essentiel checkout remains available without PRO migration");
  for (const priceOverride of [
    { active: false }, { currency: "eur" }, { unit_amount: 29000 }, { type: "one_time" },
    { recurring: { interval: "year", interval_count: 1, usage_type: "licensed" } },
    { recurring: { interval: "month", interval_count: 2, usage_type: "licensed" } },
    { recurring: { interval: "month", interval_count: 1, usage_type: "metered" } },
    { billing_scheme: "tiered" }, { transform_quantity: { divide_by: 10, round: "up" } },
  ]) {
    reset(); state.priceOverride = priceOverride;
    ok((await checkout.POST(request("pro"))).status === 503, `Mismatched Price refused: ${JSON.stringify(priceOverride)}`);
    ok(state.calls.checkouts.length === 0 && state.calls.customers === 0 && state.calls.expired === 0, "Price mismatch has no customer/session mutation");
  }
  reset(); ok((await checkout.POST(request("pro", "invalid"))).status === 400, "Invalid billing cadence rejected");
  reset(); state.subscriptions = [{ status: "active" }];
  ok((await checkout.POST(request("pro"))).body.destination === "portal", "Existing paid subscription changes through portal");
  ok(state.calls.checkouts.length === 0 && state.calls.portals === 1, "Upgrade cannot start duplicate recurring charge");
  reset(); state.sessions = [openSession("premium", "monthly")]; state.linePrice = "price_premium_monthly";
  ok((await checkout.POST(request("pro"))).body.url.endsWith("/open") && state.calls.checkouts.length === 0, "PRO alias reuses matching canonical checkout");
  reset(); state.sessions = [openSession("premium", "monthly")]; state.linePrice = "price_essentiel_monthly";
  await checkout.POST(request("pro"));
  ok(state.calls.expired === 1 && state.calls.checkouts[0].line_items[0].price === "price_premium_monthly", "Stale open session with wrong Price is replaced");
  reset(); state.sessions = [openSession("essentiel", "monthly")];
  await checkout.POST(request("pro", "yearly"));
  ok(state.calls.expired === 1 && state.calls.checkouts[0].line_items[0].price === "price_premium_yearly", "Changing plan and cadence expires earlier unpaid checkout");
  reset(); state.customerOrganization = "foreign_org";
  ok((await checkout.POST(request("pro"))).status === 503 && state.calls.checkouts.length === 0, "Cross-company customer mapping rejected");
  reset(); await assert.rejects(() => billing.createPlanCheckoutSession("cus_fixture", "business", "price_business_monthly", org, "monthly"), /PLAN_NOT_AVAILABLE/);
  ok(state.calls.checkouts.length === 0, "Direct helper cannot purchase hidden Business");
  reset(); await assert.rejects(() => billing.createPlanCheckoutSession("cus_fixture", "premium", "price_essentiel_monthly", org, "monthly"), /BILLING_PRICE_MISMATCH/);
  ok(state.calls.checkouts.length === 0, "Direct helper rejects wrong plan Price");
  const result = { success: true, checks: checks.length, scope: "Real modules with synthetic boundaries; no network, customer, session or charge", results: checks };
  fs.writeFileSync(path.join(__dirname, "billing-fixtures.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ success: true, checks: checks.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
