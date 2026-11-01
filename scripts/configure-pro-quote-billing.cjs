/* eslint-disable @typescript-eslint/no-require-imports -- reviewed reversible Stripe portal configuration */
// Read-only by default. This changes ONLY the managed portal configuration.
// Products, Prices, customers, sessions, subscriptions and payments are never mutated.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { MARKER: PRO_MARKER } = require("./provision-pro-billing.cjs");
const MARKER = "felexia_pro_quote_20261101";

function productId(price) { return typeof price.product === "string" ? price.product : price.product?.id; }
function updateParameters(update) {
  return {
    enabled: update.enabled,
    default_allowed_updates: update.default_allowed_updates ?? [],
    proration_behavior: update.proration_behavior ?? "none",
    billing_cycle_anchor: update.billing_cycle_anchor ?? "unchanged",
    trial_update_behavior: update.trial_update_behavior ?? "end_trial",
    schedule_at_period_end: { conditions: update.schedule_at_period_end?.conditions ?? [] },
    products: (update.products ?? []).map(item => ({ product: item.product, prices: [...item.prices],
      ...(item.adjustable_quantity ? { adjustable_quantity: structuredClone(item.adjustable_quantity) } : {}) })),
  };
}
function isQuotePortal(configuration, expected) {
  const update = configuration.features.subscription_update;
  const products = update.products ?? [];
  return configuration.active && configuration.metadata?.[MARKER] === "true"
    && update.enabled && update.default_allowed_updates?.join() === "price"
    && products.length === 1 && products[0].product === expected.product
    && products[0].prices.length === 2 && [...products[0].prices].sort().join() === [...expected.prices].sort().join()
    && products[0].adjustable_quantity?.enabled === false;
}
async function prepareQuote(stripe, env) {
  const prices = await Promise.all([["MONTHLY", 9900, "month"], ["YEARLY", 118800, "year"]].map(async ([cycle, amount, interval]) => {
    const id = env[`STRIPE_PRICE_ESSENTIEL_${cycle}`];
    if (!id) throw Error("ESSENTIEL_PRICE_MISSING");
    const price = await stripe.prices.retrieve(id);
    if (!price.active || price.type !== "recurring" || price.billing_scheme !== "per_unit" || price.unit_amount !== amount
      || price.currency !== "mad" || price.recurring?.interval !== interval || price.recurring.interval_count !== 1
      || price.recurring.usage_type !== "licensed" || price.transform_quantity !== null) throw Error("ESSENTIEL_PRICE_MISMATCH");
    return price;
  }));
  if (prices[0].id === prices[1].id || productId(prices[0]) !== productId(prices[1]) || !productId(prices[0]) || prices[0].livemode !== prices[1].livemode) throw Error("ESSENTIEL_PRODUCT_MISMATCH");
  let configuration;
  if (env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID) {
    configuration = await stripe.billingPortal.configurations.retrieve(env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID, { expand: ["features.subscription_update.products"] });
  } else {
    const page = await stripe.billingPortal.configurations.list({ limit: 100, expand: ["data.features.subscription_update.products"] });
    const managed = page.data.filter(item => item.metadata?.[PRO_MARKER] === "true");
    if (page.has_more || managed.length !== 1) throw Error("MANAGED_PORTAL_REVIEW_REQUIRED");
    [configuration] = managed;
  }
  if (!configuration.active || configuration.metadata?.[PRO_MARKER] !== "true" || configuration.livemode !== prices[0].livemode) throw Error("MANAGED_PORTAL_MISMATCH");
  const expected = { product: productId(prices[0]), prices: prices.map(item => item.id) };
  const originalUpdate = updateParameters(configuration.features.subscription_update);
  const desiredUpdate = { ...originalUpdate, enabled: true, default_allowed_updates: ["price"],
    products: [{ ...expected, adjustable_quantity: { enabled: false } }] };
  return { configuration, expected, originalUpdate, desiredUpdate, needsChange: !isQuotePortal(configuration, expected) };
}
async function applyQuote(stripe, prepared, save) {
  const current = prepared.configuration;
  const state = { marker: MARKER, runId: randomUUID(), startedAt: new Date().toISOString(), configurationId: current.id,
    livemode: current.livemode, expected: prepared.expected, originalUpdate: prepared.originalUpdate,
    originalMetadata: { [MARKER]: current.metadata?.[MARKER] ?? null, self_service_plans: current.metadata?.self_service_plans ?? null },
    updateAttempted: false, complete: false };
  save(state);
  if (prepared.needsChange) {
    state.updateAttempted = true; save(state);
    await stripe.billingPortal.configurations.update(current.id, {
      features: { subscription_update: prepared.desiredUpdate }, metadata: { [MARKER]: "true", self_service_plans: "essentiel" },
    }, { idempotencyKey: `${MARKER}-${state.runId}` });
  }
  const verified = await stripe.billingPortal.configurations.retrieve(current.id, { expand: ["features.subscription_update.products"] });
  if (!isQuotePortal(verified, prepared.expected)) throw Error("QUOTE_PORTAL_VERIFICATION_FAILED");
  state.complete = true; state.finishedAt = new Date().toISOString(); save(state);
  return state;
}
async function rollbackQuote(stripe, state, save) {
  if (state.marker !== MARKER || !state.configurationId || !state.originalUpdate || !state.expected) throw Error("QUOTE_ROLLBACK_STATE_INVALID");
  const current = await stripe.billingPortal.configurations.retrieve(state.configurationId, { expand: ["features.subscription_update.products"] });
  if (current.metadata?.[PRO_MARKER] !== "true" || current.livemode !== state.livemode) throw Error("QUOTE_ROLLBACK_PORTAL_MISMATCH");
  if (state.updateAttempted) {
    if (!isQuotePortal(current, state.expected)) throw Error("QUOTE_ROLLBACK_PORTAL_DRIFT");
    await stripe.billingPortal.configurations.update(state.configurationId, { features: { subscription_update: state.originalUpdate },
      metadata: Object.fromEntries(Object.entries(state.originalMetadata).map(([key, value]) => [key, value ?? ""])) });
  }
  state.rolledBackAt = new Date().toISOString(); save(state); return state;
}
function statePath(argument) {
  const directory = fs.realpathSync(path.resolve(__dirname, "../../backups"));
  const absolute = path.resolve(argument ?? path.join(directory, "felexia-pro-quote-billing-20261101.json"));
  const parent = fs.realpathSync(path.dirname(absolute));
  const relative = path.relative(directory, parent);
  if (relative.startsWith("..") || path.isAbsolute(relative) || path.extname(absolute) !== ".json") throw Error("PRIVATE_BACKUP_PATH_REQUIRED");
  return absolute;
}
async function main() {
  require("@next/env").loadEnvConfig(path.resolve(__dirname, ".."));
  if (!process.env.STRIPE_SECRET_KEY) throw Error("STRIPE_CONFIGURATION_MISSING");
  const Stripe = require("stripe"); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 1 });
  const rollback = process.argv.find(value => value.startsWith("--rollback="))?.slice(11);
  if (rollback) {
    const target = statePath(rollback); const state = JSON.parse(fs.readFileSync(target, "utf8"));
    await rollbackQuote(stripe, state, value => fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n"));
    console.log(JSON.stringify({ success: true, action: "rollback", subscriptionsUnchanged: true, noPayments: true })); return;
  }
  const prepared = await prepareQuote(stripe, process.env);
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ success: true, action: "read-only-plan", configurationId: prepared.configuration.id,
      livemode: prepared.configuration.livemode, needsChange: prepared.needsChange,
      before: prepared.originalUpdate, after: prepared.desiredUpdate, productsAndPricesUnchanged: true, subscriptionsUnchanged: true, noPayments: true }, null, 2)); return;
  }
  const target = statePath(process.argv.find(value => value.startsWith("--state="))?.slice(8));
  if (fs.existsSync(target)) throw Error("STATE_ALREADY_EXISTS_REVIEW_OR_ROLLBACK_FIRST");
  const applied = await applyQuote(stripe, prepared, value => fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }));
  console.log(JSON.stringify({ success: true, action: "applied", configurationId: applied.configurationId, privateState: target,
    productsAndPricesUnchanged: true, subscriptionsUnchanged: true, noPayments: true }));
}
module.exports = { MARKER, prepareQuote, applyQuote, rollbackQuote, isQuotePortal };
if (require.main === module) main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message ?? "") ? error.message : "QUOTE_PORTAL_FAILED"); process.exitCode = 1; });
