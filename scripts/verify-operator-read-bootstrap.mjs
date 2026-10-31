// Real read functions, isolated dependencies: no credentials, network or DB.
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
    if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const config = load("src/lib/subscriptions/plans-config.ts");
const modules = load("src/lib/subscriptions/plan-modules.ts", { "@/lib/subscriptions/plans-config": config });
const plans = load("src/lib/subscriptions/plans.ts", { "@/lib/subscriptions/plans-config": config, "@/lib/subscriptions/plan-modules": modules });
const roles = load("src/lib/auth/roles.ts");
const access = load("src/lib/auth/operator-access.ts", { "./roles": roles });
const subscriptionAccess = load("src/lib/subscriptions/subscription-access.ts");
const activeSubscription = { id: "subscription", status: "active", planCode: config.DEFAULT_PLAN_KEY, billingCycle: "monthly", trialEndsAt: null, currentPeriodStart: null, currentPeriodEnd: null };
let checks = 0;
const equal = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
const sameJson = (actual, expected, label) => { assert.equal(JSON.stringify(actual), JSON.stringify(expected), label); checks++; };

async function onboarding({ role, subscription = activeSubscription, completed = false, arrayRole = false, throws = false, anonymous = false }) {
  const writes = [];
  const reads = [];
  let currentSubscription = subscription;
  const database = { auth: { getUser: async () => ({ data: { user: anonymous ? null : { id: "user", user_metadata: { role: "admin" } } } }) }, from(table) {
    const query = { select(fields) { reads.push({ table, fields }); return query; }, eq() { return query; }, limit() { return query; },
      update() { writes.push(`update:${table}`); return query; },
      maybeSingle: async () => ({ data: { organization_id: "company", organization: { onboarding_completed: completed, onboarding_step: completed ? "completed" : "company" }, role: arrayRole ? [{ name: role }] : { name: role } }, error: null }),
      then(yes, no) { return Promise.resolve({ data: null, error: null }).then(yes, no); },
    };
    return query;
  } };
  const real = load("src/lib/saas.ts", {
    react: { cache: fn => fn }, "@/lib/supabase/server": { createClient: async () => database },
    "@/lib/subscriptions/plans": plans, "@/lib/subscriptions/subscription-access": subscriptionAccess,
    "@/lib/auth/operator-access": access,
    "@/lib/subscriptions/plan-access": {
      getOrganizationSubscription: async () => currentSubscription,
      ensureDefaultTrialAndModulesNoRevalidate: async () => { writes.push("ensure"); if (throws) throw Error("Simulated bootstrap rejection"); currentSubscription = activeSubscription; },
      startDefaultTrialAndEnableModules: async () => { writes.push("startTrial"); },
    },
    "@/lib/subscriptions/plan-modules": { ...modules, upsertModulesForPlan: async () => { writes.push("upsertModules"); } },
  });
  return { result: await real.getUserOnboardingStatus(), writes, reads };
}

for (const scenario of [
  { role: "operator" }, { role: "operator", arrayRole: true },
  { role: "operator", subscription: null },
  { role: "operator", subscription: { ...activeSubscription, status: "canceled" } },
]) {
  const run = await onboarding(scenario);
  sameJson(run.writes, [], "Operator page reads never initialize billing, modules or organization settings");
  equal(run.result.hasOrganization, true);
  equal(run.result.hasValidSubscription, scenario.subscription?.status === "canceled" || scenario.subscription === null ? false : true);
  equal(run.result.nextPath, scenario.subscription === null ? "/dashboard?trial_started=1" : "/dashboard");
  equal(run.reads.some(read => read.table === "organization_members" && read.fields.includes("role:roles(name)")), true, "Role comes from membership, not forged auth metadata");
}
const incompleteAdmin = await onboarding({ role: "admin" });
sameJson(incompleteAdmin.writes, ["upsertModules", "update:organizations"], "Existing administrator module bootstrap retained");
equal(incompleteAdmin.result.hasValidSubscription, true);
const missingAdmin = await onboarding({ role: "admin", subscription: null });
sameJson(missingAdmin.writes, ["ensure", "update:organizations"], "Existing administrator trial bootstrap retained");
equal(missingAdmin.result.hasValidSubscription, true);
const failedAdmin = await onboarding({ role: "admin", subscription: null, throws: true });
equal(failedAdmin.result.nextPath, "/dashboard?trial_started=1", "Bootstrap rejection remains nonfatal");
equal(failedAdmin.result.hasValidSubscription, false, "Failed bootstrap does not invent an active subscription");
const anonymous = await onboarding({ role: "operator", anonymous: true });
equal(anonymous.result.nextPath, "/login");
sameJson(anonymous.writes, []);

async function guard({ role, subscription = null, throws = false, organizationId = "company" }) {
  const calls = [];
  const workspace = { userId: "user", organization: { id: organizationId }, role, subscription, enabledModules: [] };
  let refreshed = workspace;
  const real = load("src/lib/auth/require-subscription.ts", {
    "@/lib/auth": { requireActiveWorkspace: async () => { calls.push("workspace"); return refreshed; } },
    "@/lib/supabase/server": { createClient: async () => { calls.push("client"); return {}; } },
    "@/lib/subscriptions/plan-access": { ensureDefaultTrialAndModulesNoRevalidate: async () => { calls.push("ensure"); if (throws) throw Error("Simulated bootstrap rejection"); refreshed = { ...workspace, subscription: activeSubscription }; } },
    "@/lib/subscriptions/plans": plans, "@/lib/subscriptions/plans-config": config,
    "@/lib/auth/operator-access": access, "next/navigation": { redirect: path => { throw Error(`REDIRECT:${path}`); } },
  });
  return { result: await real.requireActiveSubscription(), calls, workspace };
}
const operatorFallback = await guard({ role: "operator" });
sameJson(operatorFallback.calls, ["workspace"], "Operator missing-subscription fallback performs no administrative bootstrap");
equal(operatorFallback.result.role, "operator", "Fallback never changes organization role");
equal(operatorFallback.result.subscription.planCode, config.DEFAULT_PLAN_KEY);
sameJson(operatorFallback.result.enabledModules, plans.getEnabledModulesForPlan(config.DEFAULT_PLAN_KEY), "Existing default-plan module policy is reused exactly");
equal(operatorFallback.result.enabledModules.includes("rh"), false, "Fallback does not gain Premium modules");
const adminFallback = await guard({ role: "admin", throws: true });
sameJson(adminFallback.calls, ["workspace", "client", "ensure", "workspace"]);
sameJson({ ...operatorFallback.result.subscription, trialStartedAt: null }, { ...adminFallback.result.subscription, trialStartedAt: null }, "Operator and existing administrator error fallback are identical");
sameJson(operatorFallback.result.enabledModules, adminFallback.result.enabledModules);
const adminBootstrap = await guard({ role: "admin" });
sameJson(adminBootstrap.calls, ["workspace", "client", "ensure", "workspace"]);
equal(adminBootstrap.result.subscription, activeSubscription);
for (const role of ["operator", "admin"]) {
  const current = await guard({ role, subscription: activeSubscription });
  equal(current.result, current.workspace, "An existing subscription is preserved as before");
  sameJson(current.calls, ["workspace"]);
}
await assert.rejects(() => guard({ role: "operator", organizationId: null }), /REDIRECT:\/onboarding\/entreprise/); checks++;
if (process.argv.includes("--report")) {
  const directory = resolve(process.cwd(), "training/operator-profile/20261031");
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "read-bootstrap-unit.json"), JSON.stringify({
    checkedAt: new Date().toISOString(), success: true, checks,
    kind: "isolated-real-source-functions", externalAccess: false,
    operatorReadsAttemptNoAdministrativeWrites: true,
    administratorBootstrapRetained: true,
    defaultPlanAndModulesUnchanged: true,
  }, null, 2) + "\n");
}
console.log(`Operator read bootstrap: ${checks} checks passed on the real onboarding/subscription functions; no external access.`);
