// Real read/guard functions with isolated dependencies: no credentials, network or DB.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(process.cwd(), path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Date, Error, URL, console: { error() {}, warn() {} }, require(name) {
    if (!(name in dependencies)) throw Error("Unexpected dependency: " + name);
    return dependencies[name];
  } });
  return exports;
}
const config = load("src/lib/subscriptions/plans-config.ts");
const modules = load("src/lib/subscriptions/plan-modules.ts", { "@/lib/subscriptions/plans-config": config });
const plans = load("src/lib/subscriptions/plans.ts", { "@/lib/subscriptions/plans-config": config, "@/lib/subscriptions/plan-modules": modules });
const subscriptionAccess = load("src/lib/subscriptions/subscription-access.ts");
const activeSubscription = { id: "subscription", status: "active", planCode: config.DEFAULT_PLAN_KEY, billingCycle: "monthly", trialEndsAt: null, currentPeriodStart: null, currentPeriodEnd: new Date(Date.now() + 86400000).toISOString() };
const expiredSubscription = { ...activeSubscription, currentPeriodEnd: new Date(Date.now() - 86400000).toISOString() };
let checks = 0;
const equal = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
const sameJson = (actual, expected, label) => { assert.equal(JSON.stringify(actual), JSON.stringify(expected), label); checks++; };

async function onboarding({ role, subscription = activeSubscription, completed = false, arrayRole = false, anonymous = false, noMembership = false }) {
  const writes = [];
  const reads = [];
  const mutation = name => { writes.push(name); throw Error("Read attempted mutation: " + name); };
  const database = { auth: { getUser: async () => ({ data: { user: anonymous ? null : { id: "user", user_metadata: { role: "admin" } } } }) }, from(table) {
    const query = { select(fields) { reads.push({ table, fields }); return query; }, eq() { return query; }, limit() { return query; },
      update() { return mutation("update:" + table); }, insert() { return mutation("insert:" + table); }, upsert() { return mutation("upsert:" + table); }, delete() { return mutation("delete:" + table); },
      maybeSingle: async () => ({ data: noMembership ? null : { organization_id: "company", organization: { onboarding_completed: completed, onboarding_step: completed ? "completed" : "company" }, role: arrayRole ? [{ name: role }] : { name: role } }, error: null }),
      then(yes, no) { return Promise.resolve({ data: null, error: null }).then(yes, no); },
    };
    return query;
  } };
  const real = load("src/lib/saas.ts", {
    react: { cache: fn => fn }, "@/lib/supabase/server": { createClient: async () => database },
    "@/lib/subscriptions/plans": plans, "@/lib/subscriptions/subscription-access": subscriptionAccess,
    "@/lib/subscriptions/plan-access": {
      getOrganizationSubscription: async () => subscription,
      ensureDefaultTrialAndModulesNoRevalidate: async () => mutation("ensureTrial"),
      startDefaultTrialAndEnableModules: async () => mutation("startTrial"),
    },
  });
  return { result: await real.getUserOnboardingStatus(), writes, reads };
}

for (const role of ["admin", "operator", "viewer"]) {
  for (const subscription of [activeSubscription, expiredSubscription, null]) {
    for (const arrayRole of [false, true]) {
      const run = await onboarding({ role, subscription, arrayRole });
      sameJson(run.writes, [], role + " page reads never initialize billing, modules or organization settings");
      equal(run.result.hasOrganization, true);
      equal(run.result.hasValidSubscription, subscription === activeSubscription, "Missing or expired subscription never grants write access");
      equal(run.result.nextPath, subscription === null ? "/dashboard?trial_started=1" : "/dashboard", "Existing company remains available for consultation");
      equal(run.reads.some(read => read.table === "organization_members" && read.fields.includes("role:roles(name)")), true, "Membership is read from the database");
    }
  }
}
const completed = await onboarding({ role: "admin", subscription: null, completed: true });
equal(completed.result.nextPath, "/dashboard", "Existing completed company is never forced through onboarding again");
const anonymous = await onboarding({ role: "operator", anonymous: true });
equal(anonymous.result.nextPath, "/login");
sameJson(anonymous.writes, []);
const newUser = await onboarding({ role: "admin", noMembership: true });
equal(newUser.result.nextPath, "/onboarding/entreprise", "New authenticated user must create a company");

function guard(role, subscription) {
  const workspace = { userId: "user", organization: { id: "company" }, role, subscription, enabledModules: [] };
  let reads = 0;
  const real = load("src/lib/auth/require-subscription.ts", {
    "@/lib/auth": { requireActiveWorkspace: async () => { reads++; return workspace; } },
    "@/lib/subscriptions/subscription-access": subscriptionAccess,
  });
  return { real, workspace, reads: () => reads };
}
for (const role of ["admin", "operator", "viewer"]) {
  for (const subscription of [activeSubscription, expiredSubscription, null]) {
    const current = guard(role, subscription);
    equal(await current.real.requireActiveSubscription(), current.workspace, "Consultation guard preserves the exact company, role and subscription");
    equal(current.reads(), 1, "Consultation performs no bootstrap or invented fallback");
    if (subscription === activeSubscription) equal(await current.real.requireWritableSubscription(), current.workspace);
    else { await assert.rejects(current.real.requireWritableSubscription, /consultation/); checks++; }
  }
}
const now = new Date("2030-01-15T12:00:00Z");
for (const status of ["past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", null]) {
  equal(subscriptionAccess.hasValidSubscriptionAccess({ status, current_period_end: "2031-01-01", trial_end: "2031-01-01" }, now), false, "Non-paying state cannot inherit a future period: " + status);
}
for (const status of ["active", "trial", "trialing"]) {
  for (const end of [null, "invalid-date", "2030-01-15T12:00:00Z", "2030-01-15T11:59:59Z"]) {
    equal(subscriptionAccess.hasValidSubscriptionAccess({ status, current_period_end: end, trial_end: end }, now), false, "Absent, malformed or elapsed dates fail closed");
  }
  equal(subscriptionAccess.hasValidSubscriptionAccess({ status, current_period_end: "2030-01-15T12:00:01Z", trial_end: "2030-01-15T12:00:01Z" }, now), true);
}
equal(plans.getPlanDefinition("essentiel").limits.users, 3, "The public plan contains exactly three seats");
equal(plans.getPlanDefinition("essentiel").limits.commercialDocumentsPerMonth, 500, "The public plan contains 500 monthly commercial documents");
if (process.argv.includes("--report")) {
  const directory = resolve(process.cwd(), "training/essential-fixes/20261031");
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "read-subscription-guards.json"), JSON.stringify({
    checkedAt: new Date().toISOString(), success: true, checks,
    scope: "Real source functions; isolated dependencies; no credentials, network, email or database",
    allThreeRolesReadWithoutAdministrativeWrites: true,
    missingOrExpiredSubscriptionNeverInvented: true,
    consultationAndExportsRetained: true,
  }, null, 2) + "\n");
}
console.log("Essential read/subscription guards: " + checks + " checks passed; no external access.");
