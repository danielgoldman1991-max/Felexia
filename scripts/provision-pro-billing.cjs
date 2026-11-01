/* eslint-disable @typescript-eslint/no-require-imports -- reviewed one-off Stripe provisioning */
// Default is read-only. --apply journals reversible catalog/portal changes in
// ../backups. This script never creates a customer, session, payment or subscription.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const MARKER = "felexia_pro_offer_20261101";
const ORIGIN = "https://www.felexia.pro";

function productId(price) { return typeof price.product === "string" ? price.product : price.product?.id; }
function expectedPrice(price, amount, interval) {
  return price.active && price.type === "recurring" && price.billing_scheme === "per_unit"
    && price.currency === "mad" && price.unit_amount === amount && price.transform_quantity === null
    && price.recurring?.interval === interval && price.recurring.interval_count === 1
    && price.recurring.usage_type === "licensed";
}
async function managedConfigurations(stripe) {
  const page = await stripe.billingPortal.configurations.list({ limit: 100, expand: ["data.features.subscription_update.products"] });
  if (page.has_more) throw Error("PORTAL_CONFIGURATION_LIST_REVIEW_REQUIRED");
  const matches = page.data.filter(row => row.metadata?.[MARKER] === "true");
  if (matches.length > 1) throw Error("MULTIPLE_MANAGED_PORTAL_CONFIGURATIONS");
  return matches;
}
function portalParameters(products) {
  return {
    name: "Felexia ESSENTIEL / PRO",
    metadata: { [MARKER]: "true", public_plans: "essentiel,premium", self_service_plans: "essentiel" },
    business_profile: { headline: "Gérez votre abonnement Felexia", privacy_policy_url: `${ORIGIN}/confidentialite`, terms_of_service_url: `${ORIGIN}/conditions` },
    default_return_url: `${ORIGIN}/parametres/abonnement`,
    login_page: { enabled: false },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "name", "address", "tax_id"] },
      invoice_history: { enabled: true }, payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end", proration_behavior: "none" },
      subscription_update: { enabled: true, default_allowed_updates: ["price"],
        proration_behavior: "create_prorations", billing_cycle_anchor: "unchanged",
        products: products.filter(item => item.code === "essentiel").map(item => ({ product: item.id, prices: item.prices, adjustable_quantity: { enabled: false } })),
      },
    },
  };
}
function samePortal(configuration, parameters) {
  const actual = configuration.features;
  const sorted = value => JSON.stringify([...value].sort());
  return configuration.active && configuration.metadata?.[MARKER] === "true"
    && actual.invoice_history.enabled && actual.payment_method_update.enabled
    && actual.subscription_cancel.enabled && actual.subscription_cancel.mode === "at_period_end"
    && actual.subscription_update.enabled && sorted(actual.subscription_update.default_allowed_updates) === '["price"]'
    && actual.subscription_update.proration_behavior === "create_prorations"
    && sorted((actual.subscription_update.products ?? []).map(item => `${item.product}:${sorted(item.prices)}`))
      === sorted(parameters.features.subscription_update.products.map(item => `${item.product}:${sorted(item.prices)}`));
}
async function prepare(stripe, env) {
  const specs = [
    ["essentiel", "MONTHLY", 9900, "month"], ["essentiel", "YEARLY", 118800, "year"],
    ["premium", "MONTHLY", 129000, "month"], ["premium", "YEARLY", 1290000, "year"],
  ];
  const prices = await Promise.all(specs.map(async ([code, cycle, amount, interval]) => {
    const id = env[`STRIPE_PRICE_${code.toUpperCase()}_${cycle}`];
    if (!id) throw Error("PRICE_CONFIGURATION_MISSING");
    const price = await stripe.prices.retrieve(id);
    if (!expectedPrice(price, amount, interval)) throw Error("PRICE_CONFIGURATION_MISMATCH");
    return { code, price };
  }));
  if (new Set(prices.map(item => item.price.id)).size !== 4 || new Set(prices.map(item => item.price.livemode)).size !== 1) throw Error("PRICE_CONFIGURATION_AMBIGUOUS");
  const groups = ["essentiel", "premium"].map(code => {
    const selected = prices.filter(item => item.code === code).map(item => item.price);
    if (!productId(selected[0]) || productId(selected[0]) !== productId(selected[1])) throw Error("PRODUCT_MAPPING_MISMATCH");
    return { code, id: productId(selected[0]), prices: selected.map(item => item.id) };
  });
  if (groups[0].id === groups[1].id) throw Error("PRODUCT_MAPPING_AMBIGUOUS");
  const products = await Promise.all(groups.map(async group => ({ ...group, product: await stripe.products.retrieve(group.id) })));
  for (const item of products) if (item.product.deleted || !item.product.active || !item.product.name.startsWith("Felexia") || item.product.livemode !== prices[0].price.livemode) throw Error("PRODUCT_REVIEW_REQUIRED");
  const parameters = portalParameters(groups);
  const [existing] = await managedConfigurations(stripe);
  if (existing && !samePortal(existing, parameters)) throw Error("MANAGED_PORTAL_CONFIGURATION_DRIFT");
  return { livemode: prices[0].price.livemode, products, parameters, existing: existing ?? null };
}
async function applyProvision(stripe, prepared, save) {
  const premium = prepared.products.find(item => item.code === "premium");
  const state = { marker: MARKER, runId: randomUUID(), startedAt: new Date().toISOString(), livemode: prepared.livemode,
    product: { id: premium.id, originalName: premium.product.name, originalMarker: premium.product.metadata?.[MARKER] ?? null },
    productChangeAttempted: false, configurationCreateAttempted: false,
    preexistingConfigurationId: prepared.existing?.id ?? null, configurationId: prepared.existing?.id ?? null, complete: false };
  save(state);
  if (premium.product.name !== "Felexia PRO" || premium.product.metadata?.[MARKER] !== "true") {
    state.productChangeAttempted = true; save(state);
    await stripe.products.update(premium.id, { name: "Felexia PRO", metadata: { [MARKER]: "true" } }, { idempotencyKey: `${MARKER}-product-${state.runId}` });
  }
  if (!prepared.existing) {
    state.configurationCreateAttempted = true; save(state);
    const configuration = await stripe.billingPortal.configurations.create(prepared.parameters, { idempotencyKey: `${MARKER}-portal-${state.runId}` });
    state.configurationId = configuration.id; save(state);
  }
  const [product, configuration] = await Promise.all([
    stripe.products.retrieve(premium.id), stripe.billingPortal.configurations.retrieve(state.configurationId, { expand: ["features.subscription_update.products"] }),
  ]);
  if (product.name !== "Felexia PRO" || !samePortal(configuration, prepared.parameters)) throw Error("PROVISION_VERIFICATION_FAILED");
  state.complete = true; state.finishedAt = new Date().toISOString(); save(state);
  return state;
}
async function rollbackProvision(stripe, state, save) {
  if (state.marker !== MARKER || !state.product?.id) throw Error("ROLLBACK_STATE_INVALID");
  const product = await stripe.products.retrieve(state.product.id);
  if (product.deleted || product.livemode !== state.livemode) throw Error("ROLLBACK_PRODUCT_MISMATCH");
  if (state.productChangeAttempted) {
    if (product.name !== "Felexia PRO" && product.name !== state.product.originalName) throw Error("ROLLBACK_PRODUCT_DRIFT");
    if (product.name === "Felexia PRO") {
      if (product.metadata?.[MARKER] !== "true") throw Error("ROLLBACK_PRODUCT_MARKER_MISMATCH");
      await stripe.products.update(product.id, { name: state.product.originalName, metadata: { [MARKER]: state.product.originalMarker ?? "" } });
    }
  }
  if (state.configurationCreateAttempted && !state.preexistingConfigurationId) {
    let id = state.configurationId;
    if (!id) { const [found] = await managedConfigurations(stripe); id = found?.id; }
    if (id) {
      const configuration = await stripe.billingPortal.configurations.retrieve(id);
      if (configuration.metadata?.[MARKER] !== "true" || configuration.livemode !== state.livemode) throw Error("ROLLBACK_PORTAL_MISMATCH");
      await stripe.billingPortal.configurations.update(id, { active: false });
    }
  }
  state.rolledBackAt = new Date().toISOString(); save(state);
  return state;
}
function privateStatePath(argument) {
  const backupRoot = fs.realpathSync(path.resolve(__dirname, "../../backups"));
  const absolute = path.resolve(argument ?? path.join(backupRoot, "felexia-pro-billing-20261101.json"));
  const parent = fs.realpathSync(path.dirname(absolute));
  const relative = path.relative(backupRoot, parent);
  if (relative.startsWith("..") || path.isAbsolute(relative) || path.extname(absolute) !== ".json") throw Error("PRIVATE_BACKUP_PATH_REQUIRED");
  return absolute;
}
async function main() {
  require("@next/env").loadEnvConfig(path.resolve(__dirname, ".."));
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw Error("STRIPE_CONFIGURATION_MISSING");
  const Stripe = require("stripe"); const stripe = new Stripe(key, { timeout: 15000, maxNetworkRetries: 1 });
  const rollback = process.argv.find(value => value.startsWith("--rollback="))?.slice(11);
  if (rollback) {
    const target = privateStatePath(rollback); const state = JSON.parse(fs.readFileSync(target, "utf8"));
    await rollbackProvision(stripe, state, value => fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n"));
    console.log(JSON.stringify({ success: true, action: "rollback", noPayments: true })); return;
  }
  const prepared = await prepare(stripe, process.env);
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ success: true, action: "read-only-plan", livemode: prepared.livemode,
      product: { id: prepared.products[1].id, before: prepared.products[1].product.name, after: "Felexia PRO" },
      configuration: prepared.existing?.id ?? "create-dedicated", parameters: prepared.parameters, noPayments: true }, null, 2)); return;
  }
  const target = privateStatePath(process.argv.find(value => value.startsWith("--state="))?.slice(8));
  if (fs.existsSync(target)) throw Error("STATE_ALREADY_EXISTS_REVIEW_OR_ROLLBACK_FIRST");
  const state = await applyProvision(stripe, prepared, value => fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }));
  console.log(JSON.stringify({ success: true, action: "applied", configurationId: state.configurationId, environmentKey: "STRIPE_BILLING_PORTAL_CONFIGURATION_ID", privateState: target, noPayments: true }));
}
module.exports = { MARKER, prepare, applyProvision, rollbackProvision, portalParameters, samePortal };
if (require.main === module) main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message ?? "") ? error.message : "PROVISION_FAILED"); process.exitCode = 1; });
