/* eslint-disable @typescript-eslint/no-require-imports -- synthetic Stripe provisioning boundaries */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MARKER, prepare, applyProvision, rollbackProvision, portalParameters } = require("../../../scripts/provision-pro-billing.cjs");
const env = {};
for (const code of ["essentiel", "premium"]) for (const interval of ["monthly", "yearly"]) env[`STRIPE_PRICE_${code.toUpperCase()}_${interval.toUpperCase()}`] = `price_${code}_${interval}`;
let state;
function reset() {
  state = { products: { prod_essentiel: { id: "prod_essentiel", name: "Felexia Essentiel", active: true, livemode: false, metadata: {} },
    prod_premium: { id: "prod_premium", name: "Felexia Premium", active: true, livemode: false, metadata: { keep: "untouched" } } }, configurations: [], writes: [], priceOverride: {} };
}
const stripe = {
  prices: { retrieve: async id => {
    const [, code, interval] = id.split("_");
    return { id, product: `prod_${code}`, active: true, livemode: false, type: "recurring", billing_scheme: "per_unit", currency: "mad",
      unit_amount: (code === "premium" ? 1290 : 290) * (interval === "yearly" ? 10 : 1) * 100,
      transform_quantity: null, recurring: { interval: interval === "yearly" ? "year" : "month", interval_count: 1, usage_type: "licensed" }, ...state.priceOverride };
  } },
  products: {
    retrieve: async id => state.products[id],
    update: async (id, body) => {
      state.writes.push(["product", id, body]); const product = state.products[id];
      if (body.name) product.name = body.name;
      for (const [key, value] of Object.entries(body.metadata ?? {})) { if (value === "") delete product.metadata[key]; else product.metadata[key] = value; }
      return product;
    },
  },
  billingPortal: { configurations: {
    list: async options => {
      assert(options.expand.includes("data.features.subscription_update.products"), "Stripe omits portal products unless expanded when listing");
      return { data: state.configurations, has_more: false };
    },
    retrieve: async (id, options) => {
      const row = structuredClone(state.configurations.find(item => item.id === id));
      if (!options?.expand?.includes("features.subscription_update.products")) delete row.features.subscription_update.products;
      return row;
    },
    create: async body => { state.writes.push(["configuration", "create", body]); const row = { ...structuredClone(body), id: "bpc_fixture", active: true, livemode: false }; state.configurations.push(row); return row; },
    update: async (id, body) => { state.writes.push(["configuration", "update", body]); const row = state.configurations.find(item => item.id === id); Object.assign(row, body); return row; },
  } },
};
const checks = [];
function ok(condition, label) { assert.equal(condition, true, label); checks.push(label); }
async function main() {
  reset(); const prepared = await prepare(stripe, env);
  ok(state.writes.length === 0, "Prepare is strictly read-only");
  ok(prepared.products[1].product.name === "Felexia Premium", "Plan preserves original product before apply");
  const journal = []; const save = value => journal.push(structuredClone(value));
  const applied = await applyProvision(stripe, prepared, save);
  ok(journal[0].product.originalName === "Felexia Premium" && !journal[0].productChangeAttempted, "Original product snapshot journaled before mutation");
  ok(state.writes.filter(item => item[0] === "product").length === 1 && state.writes[0][1] === "prod_premium", "Only referenced premium product is renamed");
  ok(state.products.prod_essentiel.name === "Felexia Essentiel" && state.products.prod_premium.metadata.keep === "untouched", "Essentiel and unrelated metadata preserved");
  ok(state.products.prod_premium.name === "Felexia PRO" && state.products.prod_premium.metadata[MARKER] === "true", "PRO product name and release marker saved");
  const config = state.configurations[0];
  ok(config.features.subscription_update.products.length === 2 && config.features.subscription_update.products.every(item => item.prices.length === 2), "Dedicated portal exposes exactly two products and four Prices");
  ok(config.features.subscription_update.default_allowed_updates.join() === "price" && config.features.subscription_update.products.every(item => item.adjustable_quantity.enabled === false), "Portal cannot increase quantity or add promotion codes");
  ok(config.features.subscription_cancel.mode === "at_period_end" && config.features.subscription_cancel.proration_behavior === "none", "Cancellation scheduled at period end");
  ok(config.features.payment_method_update.enabled && config.features.invoice_history.enabled, "Payment methods and invoice history available");
  ok(applied.complete && applied.configurationId === "bpc_fixture", "Apply verifies catalog and portal before completion");
  const again = await prepare(stripe, env); const before = state.writes.length;
  await applyProvision(stripe, again, save);
  ok(state.writes.length === before, "Already matching provision is idempotent");
  await rollbackProvision(stripe, applied, save);
  ok(state.products.prod_premium.name === "Felexia Premium" && !(MARKER in state.products.prod_premium.metadata), "Rollback restores product name and original metadata marker");
  ok(!state.configurations[0].active && state.products.prod_premium.metadata.keep === "untouched", "Rollback only deactivates created portal and preserves unrelated metadata");
  reset(); state.priceOverride = { currency: "eur" }; await assert.rejects(() => prepare(stripe, env), /PRICE_CONFIGURATION_MISMATCH/);
  ok(state.writes.length === 0, "Invalid price cannot change any Stripe state");
  reset(); const params = portalParameters([{ id: "prod_essentiel", prices: ["price_essentiel_monthly", "price_essentiel_yearly"] }, { id: "prod_premium", prices: ["price_premium_monthly", "price_premium_yearly"] }]);
  state.configurations = [{ ...params, id: "bpc_fixture", active: true, livemode: false }]; state.configurations[0].features.subscription_update.enabled = false;
  await assert.rejects(() => prepare(stripe, env), /MANAGED_PORTAL_CONFIGURATION_DRIFT/);
  ok(state.writes.length === 0, "Managed configuration drift requires review");
  fs.writeFileSync(path.join(__dirname, "provisioning-fixtures.json"), JSON.stringify({ success: true, checks: checks.length, scope: "Synthetic Stripe only; no environment/network/customer/session/payment", results: checks }, null, 2) + "\n");
  console.log(JSON.stringify({ success: true, checks: checks.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
