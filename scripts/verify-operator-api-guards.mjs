// Execute the real handlers with isolated auth/database/Stripe adapters.
// No environment file, credentials, network call or real mutation is used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const operatorAccess = ts.transpileModule(readFileSync(resolve(root, "src/lib/auth/operator-access.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const roles = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(resolve(root, "src/lib/auth/roles.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: roles.exports });
const policy = { exports: {} };
vm.runInNewContext(operatorAccess, { exports: policy.exports, require: () => roles.exports, URL });

const routes = [
  ["checkout", "src/app/api/stripe/checkout/route.ts"],
  ["portal", "src/app/api/stripe/portal/route.ts"],
  ["trial", "src/app/api/subscriptions/start-trial/route.ts"],
  ["onboarding", "src/app/api/onboarding/complete/route.ts"],
];
let checks = 0;

async function invoke(path, { role = "operator", roleArray = false, authenticated = true } = {}) {
  const calls = [];
  const memberQueries = [];
  const membership = { organization_id: "own-company", role: roleArray ? [{ name: role }] : { name: role } };
  const supabase = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "signed-in-user", email: "test@example.invalid" } : null }, error: null }) },
    from(table) {
      const filters = [];
      const row = () => table === "organization_members" ? membership
        : table === "profiles" ? { full_name: "Test user" }
          : table === "organizations" ? { name: "Test company", stripe_customer_id: "cus_test" } : null;
      const query = {
        select(columns) { if (table === "organization_members") memberQueries.push({ columns, filters }); return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        limit() { return query; },
        update() { calls.push("database.update"); return query; },
        single: async () => ({ data: row(), error: null }),
        maybeSingle: async () => ({ data: row(), error: null }),
        then(onFulfilled, onRejected) { return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected); },
      };
      return query;
    },
  };
  const stripe = {
    createStripeCustomer: async () => { calls.push("stripe.customer"); return { id: "cus_test" }; },
    createPlanCheckoutSession: async () => { calls.push("stripe.checkout"); return { url: "https://example.invalid/checkout" }; },
    createPortalSession: async () => { calls.push("stripe.portal"); return { url: "https://example.invalid/portal" }; },
    getStripePriceIdForPlan: () => "price_test",
  };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), { ...options, headers: { "content-type": "application/json" } }) } },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/stripe": stripe,
    "@/lib/env": { hasStripeEnv: () => true },
    "@/lib/subscriptions/plans": { normalizePlanCode: (value) => value === "essentiel" ? value : "essentiel" },
    "@/lib/subscriptions/commercial-offers": { isPlanPubliclyAvailable: (value) => value === "essentiel" },
    "@/lib/subscriptions/subscription-access": { canAccessApp: () => false },
    "@/lib/subscriptions/plan-access": { startDefaultTrialAndEnableModules: async () => { calls.push("subscription.startTrial"); } },
    "@/lib/auth/operator-access": policy.exports,
  };
  const handler = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(resolve(root, path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports: handler.exports,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; },
    console: { error() {}, log() {} },
  });
  // A forged client role/company must not override the authenticated membership.
  const response = await handler.exports.POST({ json: async () => ({ planCode: "essentiel", billingInterval: "monthly", role: "admin", organizationId: "other-company" }) });
  return { response, body: await response.json(), calls, memberQueries };
}

for (const [name, path] of routes) {
  for (const roleArray of [false, true]) {
    const result = await invoke(path, { roleArray });
    assert.equal(result.response.status, 403, `${name}: operator denied`); checks++;
    assert.equal(result.body.code, "OPERATOR_ACCESS_DENIED", `${name}: stable denial code`); checks++;
    assert.equal(result.body.error, policy.exports.OPERATOR_ACCESS_ERROR); checks++;
    assert.deepEqual(result.calls, [], `${name}: no billing/trial/database mutation before denial`); checks++;
    assert.ok(result.memberQueries.some((query) => query.columns.includes("role:roles(name)")
      && query.filters.some(([key, value]) => key === "user_id" && value === "signed-in-user")
      && query.filters.some(([key, value]) => key === "status" && value === "active")), `${name}: role from active session membership`); checks++;
  }
  const anonymous = await invoke(path, { authenticated: false });
  assert.equal(anonymous.response.status, 401, `${name}: anonymous remains denied`); checks++;
  assert.deepEqual(anonymous.calls, [], `${name}: anonymous cannot mutate`); checks++;
  const admin = await invoke(path, { role: "admin" });
  assert.equal(admin.response.status, 200, `${name}: administrator retains existing flow`); checks++;
  assert.ok(admin.calls.length > 0, `${name}: administrator reaches the isolated billing/update adapter`); checks++;
}
console.log(`Operator API guards: ${checks} checks passed across four real route handlers; no external access.`);
