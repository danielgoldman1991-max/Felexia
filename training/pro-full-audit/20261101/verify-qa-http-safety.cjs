/* eslint-disable @typescript-eslint/no-require-imports -- isolated audit harness safety fixtures */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EXPECTED_ORG, EXPECTED_RUN, verifyManifest, limited, businessRow, restore, isEligibleEdit } = require("../../../scripts/audit-qa-pro-http.cjs");
const results = [];
function check(condition, name) { assert.equal(condition, true, name); results.push(name); }
const manifest = { run: EXPECTED_RUN, organizationId: EXPECTED_ORG, companyName: "FELEXIA RECETTE ESSENTIELLE 20261031202921", authorizedMailbox: "qa@example.test",
  users: { admin: { id: "10000000-0000-4000-8000-000000000001", email: "qa+recette123admin@example.test", password: "synthetic" } } };
const original = { id: "10000000-0000-4000-8000-000000000002", organization_id: EXPECTED_ORG, plan_code: "essentiel", plan_id: "10000000-0000-4000-8000-000000000003", status: "trialing",
  trial_ends_at: "2026-11-30T12:00:00.000Z", current_period_end: null, stripe_customer_id: "cus_fixture", stripe_subscription_id: null, created_at: "2026-10-31T12:00:00.000Z", updated_at: "2026-10-31T12:00:00.000Z" };
const premiumPlanId = "10000000-0000-4000-8000-000000000004";
let current, writes;
const service = { from(table) {
  assert.equal(table, "organization_subscriptions"); let update; const filters = [];
  const query = { select() { return query; }, limit() { return query; }, update(payload) { update = payload; return query; },
    eq(key, value) { filters.push([key, value]); return query; }, is(key, value) { filters.push([key, value]); return query; },
    then(resolve) {
      if (update) {
        writes.push({ update, filters });
        if (!filters.every(([key, value]) => current[key] === value)) return Promise.resolve({ data: [], error: null }).then(resolve);
        current = { ...current, ...update, updated_at: "2026-11-01T12:00:00.000Z" };
      }
      return Promise.resolve({ data: filters.every(([key, value]) => current[key] === value) || update ? [structuredClone(current)] : [], error: null }).then(resolve);
    } };
  return query;
} };
async function main() {
  verifyManifest(manifest); check(true, "Only the explicit existing synthetic QA marker is accepted");
  for (const changed of [{ organizationId: "10000000-0000-4000-8000-000000000099" }, { run: "another-run" }, { companyName: "Customer company" }, { users: { admin: { ...manifest.users.admin, email: "owner@example.test" } } }]) {
    assert.throws(() => verifyManifest({ ...manifest, ...changed })); check(true, "Changed company/run/alias scope is rejected before any audit action");
  }
  current = { ...original, plan_code: "premium", plan_id: premiumPlanId, updated_at: "2026-11-01T10:00:00.000Z" }; writes = [];
  const recovery = { planUpdateAttempted: true, restorationRequired: true, originalSubscription: structuredClone(original), premiumPlanId };
  let saves = 0; await restore(service, recovery, () => saves++);
  check(writes.length === 1 && Object.keys(writes[0].update).sort().join() === "plan_code,plan_id", "Restoration writes exactly the two temporary plan fields");
  check(writes[0].filters.some(([key, value]) => key === "organization_id" && value === EXPECTED_ORG) && writes[0].filters.some(([key]) => key === "updated_at"), "Restoration uses company scope and audit timestamp CAS");
  check(JSON.stringify(businessRow(current)) === JSON.stringify(businessRow(original)) && current.updated_at !== original.updated_at, "All contract/date/Stripe fields restored while audit updated_at may advance");
  check(!recovery.restorationRequired && saves === 1, "Recovery journal closes only after verified restoration");
  writes = []; await restore(service, recovery, () => saves++);
  check(writes.length === 0, "Already restored subscription is not modified again");
  current = { ...original, plan_code: "premium", plan_id: premiumPlanId, stripe_subscription_id: "sub_foreign_change", updated_at: "2026-11-01T11:00:00.000Z" }; writes = [];
  const drift = { planUpdateAttempted: true, restorationRequired: true, originalSubscription: structuredClone(original), premiumPlanId };
  await assert.rejects(() => restore(service, drift, () => {}), /QA_RESTORE_CONTRACT_DRIFT/);
  check(writes.length === 0 && drift.restorationRequired, "Concurrent contract change is preserved and recovery remains pending");
  let inFlight = 0; let peak = 0;
  const values = await limited(Array.from({ length: 11 }, (_, index) => index), async value => {
    inFlight++; peak = Math.max(peak, inFlight); await new Promise(resolve => setImmediate(resolve)); inFlight--; return value * 2;
  });
  check(peak === 3 && values.length === 11 && values[10] === 20, "Audit requests are bounded to three concurrent operations and preserve results");
  check(!isEligibleEdit("/facturation/factures/[id]/edit", { status: "validated" }) && isEligibleEdit("/facturation/factures/[id]/edit", { status: "draft" }), "Invoice edit audit respects the actual draft-only page guard");
  check(!isEligibleEdit("/facturation/paiements/[id]/edit", { status: "confirmed", allocated_amount: 120 }) && isEligibleEdit("/facturation/paiements/[id]/edit", { status: "confirmed", allocated_amount: 0 }), "Payment edit audit respects the actual allocated-payment page guard");
  fs.writeFileSync(path.join(__dirname, "qa-http-safety-fixtures.json"), JSON.stringify({ success: true, checks: results.length, scope: "Real harness helpers; synthetic state only; no env/network/database/credentials", results }, null, 2) + "\n");
  console.log(JSON.stringify({ success: true, checks: results.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
