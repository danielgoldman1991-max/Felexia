/* eslint-disable @typescript-eslint/no-require-imports -- isolated maintenance and legacy mapping fixture */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { PRODUCT, PORTAL, MARKER, SPECS, prepare, apply, rollbackConfiguration, portalInvariant, productInvariant } = require("../../../scripts/reprice-essentiel-99.cjs");
const clone = structuredClone;
let cases = 0;
function ok(value, message) { assert.ok(value, message); cases++; }
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); cases++; }
function fixture() {
  const prices = SPECS.map(s => ({ id: s.oldId, product: PRODUCT, active: true, livemode: true, type: "recurring", currency: "mad", unit_amount: s.oldAmount,
    billing_scheme: "per_unit", transform_quantity: null, recurring: { interval: s.interval, interval_count: 1, usage_type: "licensed" }, tax_behavior: "unspecified", metadata: {}, lookup_key: null }));
  const data = { prices, product: { id: PRODUCT, active: true, livemode: true, name: "Felexia Essentiel", metadata: {}, description: "preserved", default_price: SPECS[0].oldId },
    portal: { id: PORTAL, active: true, livemode: true, metadata: { felexia_pro_offer_20261101: "true", felexia_pro_quote_20261101: "true", self_service_plans: "essentiel" },
      features: { customer_update: { enabled: true, allowed_updates: ["email", "name"] }, subscription_cancel: { enabled: true, mode: "at_period_end" },
        subscription_update: { enabled: true, proration_behavior: "create_prorations", default_allowed_updates: ["price"], trial_update_behavior: "end_trial",
          products: [{ product: PRODUCT, prices: SPECS.map(s => s.oldId), adjustable_quantity: { enabled: false, minimum: 1, maximum: null } }] } },
      default_return_url: "https://www.felexia.pro/parametres/abonnement" }, subscriptions: [], writes: [], saves: [] };
  const client = { prices: { retrieve: async id => clone(data.prices.find(p => p.id === id)), list: async () => ({ data: clone(data.prices), has_more: false }),
    create: async (body, opts) => { data.writes.push({ kind: "price", body: clone(body), opts }); const price = { ...clone(body), id: "price_new_"+body.metadata.billing_cycle,
      active: true, livemode: true, type: "recurring", transform_quantity: null }; data.prices.push(price); return clone(price); } },
    products: { retrieve: async () => clone(data.product), update: async (id, body, opts) => { equal(id, PRODUCT); equal(Object.keys(body), ["default_price"]); data.writes.push({ kind: "product", body, opts }); Object.assign(data.product, body); return clone(data.product); } },
    billingPortal: { configurations: { retrieve: async () => clone(data.portal), update: async (id, body, opts) => { equal(id, PORTAL); equal(Object.keys(body), ["features"]);
      data.writes.push({ kind: "portal", body: clone(body), opts }); const input = body.features.subscription_update.products[0];
      data.portal.features.subscription_update.products[0].prices = clone(input.prices); return clone(data.portal); } } },
    subscriptions: { list: async () => ({ data: clone(data.subscriptions), has_more: false }) } };
  return { data, client, save: state => data.saves.push(clone(state)) };
}
async function rejectPrepare(mutator, expected) {
  const f = fixture(); mutator(f.data);
  await assert.rejects(() => prepare(f.client), new RegExp(expected)); cases++;
  equal(f.data.writes.length, 0, "invalid read state cannot write");
}
async function main() {
  const f = fixture();
  const prepared = await prepare(f.client);
  equal(f.data.writes.length, 0, "preflight remains read only");
  const state = await apply(f.client, prepared, null, f.save);
  equal(state.priceIds, { monthly: "price_new_monthly", yearly: "price_new_yearly" });
  equal(f.data.writes.map(w => w.kind), ["price", "price", "product", "portal"]);
  ok(f.data.saves[0].before.product.default_price === SPECS[0].oldId && f.data.saves[0].createdPriceIds.length === 0, "journal predates first external mutation");
  equal(f.data.writes.filter(w => w.kind === "price").map(w => w.body.unit_amount), [9900, 118800]);
  equal(f.data.writes.filter(w => w.kind === "price").map(w => w.opts.idempotencyKey), [MARKER+"_monthly", MARKER+"_yearly"]);
  equal(f.data.prices.slice(0, 2), state.before.oldPrices, "historical immutable prices remain active and exact");
  equal(productInvariant(f.data.product), productInvariant(state.before.product));
  equal(portalInvariant(f.data.portal), portalInvariant(state.before.portal), "unrelated portal settings and quantity limits survive");
  ok(state.subscriptionsUnchanged && state.complete && state.subscriptionsAfter.total === 0);
  const writesBefore = f.data.writes.length;
  await apply(f.client, await prepare(f.client, state), state, f.save);
  equal(f.data.writes.length, writesBefore, "repeat application is idempotent");
  await rollbackConfiguration(f.client, state, f.save);
  equal(f.data.product, state.before.product, "configuration rollback restores original product");
  equal(f.data.portal, state.before.portal, "configuration rollback restores original portal");
  equal(f.data.prices.length, 4, "rollback does not archive prices or touch contracts");
  await apply(f.client, await prepare(f.client, state), state, f.save);
  equal(f.data.prices.length, 4, "reapplying rollback reuses the same prices");

  await rejectPrepare(d => { d.product.name = "Other"; }, "PRODUCT_SCOPE_DRIFT");
  await rejectPrepare(d => { d.product.default_price = "unexpected"; }, "PRODUCT_DEFAULT_DRIFT");
  await rejectPrepare(d => { d.prices[0].currency = "eur"; }, "HISTORICAL_PRICE_DRIFT");
  await rejectPrepare(d => { d.prices[1].unit_amount = 118800; }, "HISTORICAL_PRICE_DRIFT");
  await rejectPrepare(d => { d.portal.features.subscription_update.products.push(clone(d.portal.features.subscription_update.products[0])); }, "PORTAL_PRODUCT_SCOPE_DRIFT");
  await rejectPrepare(d => { d.portal.features.subscription_update.products[0].prices[0] = "unexpected"; }, "PORTAL_PRICE_DRIFT");
  await rejectPrepare(d => { d.portal.metadata.felexia_pro_quote_20261101 = "false"; }, "PORTAL_SCOPE_DRIFT");
  await rejectPrepare(d => { d.prices.push({ ...clone(d.prices[0]), id: "malformed", lookup_key: SPECS[0].lookup }); }, "DESIRED_PRICE_DRIFT");
  const drift = fixture(); const dp = await prepare(drift.client);
  const originalRetrieve = drift.client.products.retrieve;
  drift.client.products.retrieve = async () => { drift.data.product.description = "external concurrent update"; return originalRetrieve(); };
  await assert.rejects(() => apply(drift.client, dp, null, drift.save), /PRODUCT_CONFIGURATION_DRIFT/); cases++;
  equal(drift.data.writes.map(w => w.kind), ["price", "price"], "concurrent product drift stops configuration writes");
  const restoreDrift = fixture(); const restoreState = await apply(restoreDrift.client, await prepare(restoreDrift.client), null, restoreDrift.save);
  restoreDrift.data.portal.features.subscription_update.products[0].adjustable_quantity.minimum = 2;
  await assert.rejects(() => rollbackConfiguration(restoreDrift.client, restoreState, restoreDrift.save), /NON_PRICE_CONFIGURATION_DRIFT/); cases++;
  const writesAfter = restoreDrift.data.writes.length;
  equal(writesAfter, 4, "rollback refuses concurrent quantity changes");

  // The Stripe SDK represents decimal strings as objects containing BigInt.
  class StripeDecimal { constructor(value) { this._coefficient = BigInt(value); } toJSON() { return this._coefficient.toString(); } }
  const decimals = fixture(); const decimalRetrieve = decimals.client.prices.retrieve;
  decimals.client.prices.retrieve = async id => { const p = await decimalRetrieve(id); p.unit_amount_decimal = new StripeDecimal(p.unit_amount); return p; };
  const decimalState = await apply(decimals.client, await prepare(decimals.client), null, decimals.save);
  const restoredJournal = JSON.parse(JSON.stringify(decimalState));
  await apply(decimals.client, await prepare(decimals.client, restoredJournal), restoredJournal, decimals.save);
  equal(decimals.data.writes.length, 4, "SDK decimal JSON form compares correctly to a restored private journal");
  const interrupted = fixture(); const createBeforeTimeout = interrupted.client.prices.create; let timedOut = false;
  interrupted.client.prices.create = async (...args) => { const created = await createBeforeTimeout(...args); if (!timedOut) { timedOut = true; throw Error("SIMULATED_RESPONSE_TIMEOUT"); } return created; };
  // Recover after the server accepted one price and its response was lost.
  const initialInterrupted = await prepare(interrupted.client);
  await assert.rejects(() => apply(interrupted.client, initialInterrupted, null, interrupted.save), /SIMULATED_RESPONSE_TIMEOUT/); cases++;
  const interruptedJournal = interrupted.data.saves.at(-1);
  const resumed = await apply(interrupted.client, await prepare(interrupted.client, interruptedJournal), interruptedJournal, interrupted.save);
  equal(interrupted.data.prices.length, 4, "lookup-key recovery prevents duplicates after a lost create response");
  ok(resumed.complete && resumed.subscriptionsUnchanged);

  const source = fs.readFileSync(path.resolve(__dirname, "../../../src/lib/subscriptions/stripe-prices.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = { exports: {}, process: { env: { STRIPE_PRICE_ESSENTIEL_MONTHLY: "price_new_monthly", STRIPE_PRICE_ESSENTIEL_YEARLY: "price_new_yearly" } } };
  vm.runInNewContext(compiled, sandbox);
  for (const old of SPECS) equal(sandbox.exports.getPlanCodeFromPriceId(old.oldId), "essentiel", "legacy invoice reconciliation remains recognized");
  equal(sandbox.exports.getPlanCodeFromPriceId("price_new_monthly"), "essentiel");
  equal(sandbox.exports.getPlanCodeFromPriceId("unrecognized"), null);
  equal(sandbox.exports.getPlanCodeFromPriceId("constructor"), null);
  equal(sandbox.exports.getPlanCodeFromPriceId("__proto__"), null);
  equal(sandbox.exports.getStripePriceId("essentiel", "monthly"), "price_new_monthly", "new checkout resolves current env only");
  equal(sandbox.exports.getStripePriceId("essentiel", "yearly"), "price_new_yearly");
  ok(SPECS.every(s => sandbox.exports.getAllStripePriceIds().includes(s.oldId)));
  console.log(JSON.stringify({ passed: cases, network: false, mutations: "isolated mock only", checkout: false, payments: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
