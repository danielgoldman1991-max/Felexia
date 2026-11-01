/* eslint-disable @typescript-eslint/no-require-imports -- synthetic Stripe portal boundaries */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MARKER, prepareQuote, applyQuote, rollbackQuote } = require("../../../scripts/configure-pro-quote-billing.cjs");
const env = { STRIPE_PRICE_ESSENTIEL_MONTHLY: "price_essentiel_monthly", STRIPE_PRICE_ESSENTIEL_YEARLY: "price_essentiel_yearly", STRIPE_BILLING_PORTAL_CONFIGURATION_ID: "bpc_fixture" };
let state;
function reset() {
  state = { writes: [], priceOverride: {}, configuration: { id: "bpc_fixture", active: true, livemode: false,
    metadata: { felexia_pro_offer_20261101: "true", preserve: "untouched" },
    features: { invoice_history: { enabled: true }, payment_method_update: { enabled: true }, subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: { enabled: true, default_allowed_updates: ["price"], proration_behavior: "create_prorations", billing_cycle_anchor: "unchanged", trial_update_behavior: "end_trial",
        schedule_at_period_end: { conditions: [] }, products: [
          { product: "prod_essentiel", prices: ["price_essentiel_monthly", "price_essentiel_yearly"], adjustable_quantity: { enabled: false } },
          { product: "prod_premium", prices: ["price_premium_monthly", "price_premium_yearly"], adjustable_quantity: { enabled: false } },
        ] },
    } } };
}
const stripe = {
  prices: { retrieve: async id => ({ id, active: true, livemode: false, product: "prod_essentiel", type: "recurring", billing_scheme: "per_unit", currency: "mad",
    unit_amount: id.endsWith("yearly") ? 118800 : 9900, transform_quantity: null,
    recurring: { interval: id.endsWith("yearly") ? "year" : "month", interval_count: 1, usage_type: "licensed" }, ...state.priceOverride }) },
  billingPortal: { configurations: {
    retrieve: async id => { assert.equal(id, "bpc_fixture"); return structuredClone(state.configuration); },
    list: async () => ({ data: [structuredClone(state.configuration)], has_more: false }),
    update: async (id, body) => {
      assert.equal(id, "bpc_fixture"); state.writes.push(structuredClone(body));
      state.configuration.features = { ...state.configuration.features, ...structuredClone(body.features) };
      for (const [key, value] of Object.entries(body.metadata ?? {})) { if (value === "") delete state.configuration.metadata[key]; else state.configuration.metadata[key] = value; }
      return structuredClone(state.configuration);
    },
  } },
};
const checks = [];
function ok(condition, label) { assert.equal(condition, true, label); checks.push(label); }
async function main() {
  reset(); const original = structuredClone(state.configuration);
  const prepared = await prepareQuote(stripe, env);
  ok(prepared.needsChange && state.writes.length === 0, "Read-only plan identifies direct PRO choice without mutating Stripe");
  ok(prepared.desiredUpdate.products.length === 1 && prepared.desiredUpdate.products[0].product === "prod_essentiel", "Plan exposes only Essentiel product");
  ok(prepared.desiredUpdate.products[0].prices.join() === "price_essentiel_monthly,price_essentiel_yearly", "Both existing Essentiel billing cycles are preserved");
  const journal = []; const save = value => journal.push(structuredClone(value));
  const applied = await applyQuote(stripe, prepared, save);
  ok(journal[0].originalUpdate.products.length === 2 && !journal[0].updateAttempted, "Original portal choice journaled before any write");
  ok(state.writes.length === 1 && Object.keys(state.writes[0]).sort().join() === "features,metadata", "Apply mutates only managed portal update feature and release metadata");
  ok(state.configuration.features.subscription_update.products.length === 1 && state.configuration.metadata[MARKER] === "true", "PRO direct choice removed and quote release marked");
  ok(state.configuration.features.subscription_update.products[0].adjustable_quantity.enabled === false, "Essentiel quantity remains fixed");
  ok(JSON.stringify(state.configuration.features.invoice_history) === JSON.stringify(original.features.invoice_history)
    && JSON.stringify(state.configuration.features.payment_method_update) === JSON.stringify(original.features.payment_method_update)
    && JSON.stringify(state.configuration.features.subscription_cancel) === JSON.stringify(original.features.subscription_cancel), "Invoice history, payment methods and cancellation are unchanged");
  ok(state.configuration.features.subscription_update.proration_behavior === original.features.subscription_update.proration_behavior
    && state.configuration.features.subscription_update.trial_update_behavior === original.features.subscription_update.trial_update_behavior, "Existing proration and trial-update policy preserved");
  ok(state.configuration.metadata.preserve === "untouched" && applied.complete, "Unrelated metadata preserved and final state verified");
  const repeated = await prepareQuote(stripe, env); const before = state.writes.length;
  await applyQuote(stripe, repeated, save);
  ok(!repeated.needsChange && state.writes.length === before, "Matching quote portal is idempotent");
  await rollbackQuote(stripe, applied, save);
  ok(JSON.stringify(state.configuration.features.subscription_update) === JSON.stringify(original.features.subscription_update), "Rollback restores exact earlier subscription-update configuration");
  ok(!(MARKER in state.configuration.metadata) && !("self_service_plans" in state.configuration.metadata) && state.configuration.metadata.preserve === "untouched", "Rollback restores original metadata without touching other keys");
  reset(); state.priceOverride = { currency: "eur" };
  await assert.rejects(() => prepareQuote(stripe, env), /ESSENTIEL_PRICE_MISMATCH/);
  ok(state.writes.length === 0, "Wrong Essentiel price cannot change portal");
  reset(); delete state.configuration.metadata.felexia_pro_offer_20261101;
  await assert.rejects(() => prepareQuote(stripe, env), /MANAGED_PORTAL_MISMATCH/);
  ok(state.writes.length === 0, "Unmanaged portal cannot be altered");
  reset(); const withoutEnvId = { ...env }; delete withoutEnvId.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
  ok((await prepareQuote(stripe, withoutEnvId)).configuration.id === "bpc_fixture", "Unique managed release can be selected without environment ID");
  fs.writeFileSync(path.join(__dirname, "quote-portal-fixtures.json"), JSON.stringify({ success: true, checks: checks.length,
    scope: "Synthetic Stripe only; no environment/network/product/price/customer/session/subscription/payment mutation", results: checks }, null, 2) + "\n");
  console.log(JSON.stringify({ success: true, checks: checks.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
