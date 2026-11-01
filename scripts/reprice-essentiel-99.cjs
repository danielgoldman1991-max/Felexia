/* eslint-disable @typescript-eslint/no-require-imports -- guarded catalogue-only maintenance */
// Read-only by default. No customer, Checkout, subscription, invoice or payment write.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const PRODUCT = "prod_UVM4TonZhcOpdl";
const PORTAL = "bpc_1UWunCA1UYDHtMFwTM11tk75";
const MARKER = "felexia_essentiel_99_20261101";
const SPECS = [
  { cycle: "monthly", interval: "month", amount: 9900, oldAmount: 29000, oldId: "price_1TWLMYA1UYDHtMFw7TUgL7dI", lookup: "felexia_essentiel_mad_99_monthly_20261101" },
  { cycle: "yearly", interval: "year", amount: 118800, oldAmount: 290000, oldId: "price_1TYTQTA1UYDHtMFwCm6bSHuT", lookup: "felexia_essentiel_mad_1188_yearly_20261101" },
];
const pid = p => typeof p.product === "string" ? p.product : p.product?.id;
const defaultId = p => typeof p.default_price === "string" ? p.default_price : p.default_price?.id ?? null;
function stable(value) {
  // Stripe decimal objects expose JSON strings; preserve their documented JSON form.
  if (value && typeof value.toJSON === "function") return stable(value.toJSON());
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const digest = value => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
function omit(value, fields) { return Object.fromEntries(Object.entries(value).filter(([k]) => !fields.includes(k))); }
function priceMatches(p, spec, amount = spec.amount) {
  return p.active && p.livemode && pid(p) === PRODUCT && p.unit_amount === amount && p.currency === "mad"
    && p.type === "recurring" && p.billing_scheme === "per_unit" && p.transform_quantity === null
    && p.recurring?.interval === spec.interval && p.recurring.interval_count === 1 && p.recurring.usage_type === "licensed";
}
function desiredPrice(p, spec) {
  return priceMatches(p, spec) && p.tax_behavior === "unspecified" && p.lookup_key === spec.lookup
    && p.metadata?.[MARKER] === "true" && p.metadata.plan_code === "essentiel" && p.metadata.billing_cycle === spec.cycle;
}
function productInvariant(p) { return omit(p, ["default_price", "updated"]); }
function portalInvariant(p) {
  const v = structuredClone(omit(p, ["updated"]));
  if (v.features?.subscription_update?.products) {
    v.features.subscription_update.products.forEach(product => { delete product.prices; });
  }
  return v;
}
function portalPrices(configuration) {
  const products = configuration.features.subscription_update.products;
  if (!Array.isArray(products) || products.length !== 1 || products[0].product !== PRODUCT
    || products[0].adjustable_quantity?.enabled !== false || products[0].prices.length !== 2) throw Error("PORTAL_PRODUCT_SCOPE_DRIFT");
  return [...products[0].prices].sort();
}
async function catalogue(stripe) {
  const result = []; let after;
  do {
    const page = await stripe.prices.list({ product: PRODUCT, limit: 100, ...(after ? { starting_after: after } : {}) });
    result.push(...page.data); after = page.has_more ? page.data.at(-1)?.id : null;
    if (page.has_more && !after) throw Error("PRICE_PAGINATION_INVALID");
  } while (after);
  return result;
}
async function subscriptionSnapshot(stripe) {
  const contracts = []; let after;
  do {
    const page = await stripe.subscriptions.list({ status: "all", limit: 100, ...(after ? { starting_after: after } : {}) });
    for (const row of page.data) contracts.push({ id: row.id, status: row.status, customer: typeof row.customer === "string" ? row.customer : row.customer?.id,
      cancel_at: row.cancel_at, cancel_at_period_end: row.cancel_at_period_end,
      items: row.items.data.map(item => ({ id: item.id, price: item.price.id, quantity: item.quantity })).sort((a,b) => a.id.localeCompare(b.id)) });
    after = page.has_more ? page.data.at(-1)?.id : null;
    if (page.has_more && !after) throw Error("SUBSCRIPTION_PAGINATION_INVALID");
  } while (after);
  contracts.sort((a,b) => a.id.localeCompare(b.id));
  const nonterminal = contracts.filter(x => !["canceled", "incomplete_expired"].includes(x.status));
  return { total: contracts.length, digest: digest(contracts), oldMonthlyNonterminal: nonterminal.filter(x=>x.items.some(i=>i.price===SPECS[0].oldId)).length,
    oldYearlyNonterminal: nonterminal.filter(x=>x.items.some(i=>i.price===SPECS[1].oldId)).length };
}
async function prepare(stripe, state) {
  const [product, portal, oldPrices, allPrices, subscriptions] = await Promise.all([
    stripe.products.retrieve(PRODUCT), stripe.billingPortal.configurations.retrieve(PORTAL, { expand: ["features.subscription_update.products"] }),
    Promise.all(SPECS.map(x=>stripe.prices.retrieve(x.oldId))), catalogue(stripe), subscriptionSnapshot(stripe),
  ]);
  if (product.deleted || !product.active || !product.livemode || product.name !== "Felexia Essentiel") throw Error("PRODUCT_SCOPE_DRIFT");
  if (!portal.active || !portal.livemode || portal.metadata?.felexia_pro_offer_20261101 !== "true"
    || portal.metadata?.felexia_pro_quote_20261101 !== "true" || !portal.features.subscription_update.enabled) throw Error("PORTAL_SCOPE_DRIFT");
  oldPrices.forEach((p,i)=>{ if (!priceMatches(p,SPECS[i],SPECS[i].oldAmount) || p.tax_behavior !== "unspecified") throw Error("HISTORICAL_PRICE_DRIFT"); });
  const found = SPECS.map(spec => {
    const candidates = allPrices.filter(p=>p.lookup_key===spec.lookup || (p.metadata?.[MARKER]==="true" && p.metadata.billing_cycle===spec.cycle));
    if (candidates.length>1 || (candidates[0] && !desiredPrice(candidates[0],spec))) throw Error("DESIRED_PRICE_DRIFT");
    return candidates[0]??null;
  });
  const allowedIds = [SPECS.map(x=>x.oldId).sort(), ...(found.every(Boolean) ? [found.map(x=>x.id).sort()] : [])];
  if (!allowedIds.some(ids=>same(ids,portalPrices(portal)))) throw Error("PORTAL_PRICE_DRIFT");
  if (defaultId(product)!==SPECS[0].oldId && defaultId(product)!==found[0]?.id) throw Error("PRODUCT_DEFAULT_DRIFT");
  if (state) {
    if (state.marker!==MARKER || state.productId!==PRODUCT || state.portalId!==PORTAL) throw Error("STATE_SCOPE_INVALID");
    if (!same(productInvariant(product),productInvariant(state.before.product)) || !same(portalInvariant(portal),portalInvariant(state.before.portal))) throw Error("NON_PRICE_CONFIGURATION_DRIFT");
  }
  return { product, portal, oldPrices, found, subscriptions };
}
async function apply(stripe, prepared, existingState, save) {
  const state = existingState ?? { marker:MARKER, productId:PRODUCT, portalId:PORTAL, startedAt:new Date().toISOString(),
    before:{ product:prepared.product, portal:prepared.portal, oldPrices:prepared.oldPrices, subscriptions:prepared.subscriptions },
    priceIds:{}, createdPriceIds:[], complete:false };
  save(state);
  for (let index=0;index<SPECS.length;index++) {
    const spec=SPECS[index]; let price=prepared.found[index];
    if (!price) {
      state.pendingOperation="create_price_"+spec.cycle;save(state);
      price=await stripe.prices.create({ product:PRODUCT,currency:"mad",unit_amount:spec.amount,billing_scheme:"per_unit",tax_behavior:"unspecified",
        recurring:{interval:spec.interval,interval_count:1,usage_type:"licensed"},lookup_key:spec.lookup,
        nickname:spec.cycle==="monthly"?"ESSENTIEL 99 MAD / mois":"ESSENTIEL 1 188 MAD / an",
        metadata:{[MARKER]:"true",plan_code:"essentiel",billing_cycle:spec.cycle} },{idempotencyKey:MARKER+"_"+spec.cycle});
      if (!state.createdPriceIds.includes(price.id)) state.createdPriceIds.push(price.id);
    }
    if (!desiredPrice(price,spec)) throw Error("CREATED_PRICE_VERIFICATION_FAILED");
    state.priceIds[spec.cycle]=price.id;save(state);
  }
  const productNow=await stripe.products.retrieve(PRODUCT);
  if (!same(productInvariant(productNow),productInvariant(state.before.product))) throw Error("PRODUCT_CONFIGURATION_DRIFT");
  if (defaultId(productNow)!==state.priceIds.monthly) {
    if (defaultId(productNow)!==SPECS[0].oldId) throw Error("PRODUCT_DEFAULT_DRIFT");
    state.pendingOperation="update_default_price";save(state);
    await stripe.products.update(PRODUCT,{default_price:state.priceIds.monthly},{idempotencyKey:MARKER+"_default"});
  }
  const portalNow=await stripe.billingPortal.configurations.retrieve(PORTAL,{expand:["features.subscription_update.products"]});
  if (!same(portalInvariant(portalNow),portalInvariant(state.before.portal))) throw Error("PORTAL_CONFIGURATION_DRIFT");
  const desired=[state.priceIds.monthly,state.priceIds.yearly].sort();
  if (!same(portalPrices(portalNow),desired)) {
    if (!same(portalPrices(portalNow),SPECS.map(x=>x.oldId).sort())) throw Error("PORTAL_PRICE_DRIFT");
    state.pendingOperation="update_portal_prices";save(state);
    await stripe.billingPortal.configurations.update(PORTAL,{features:{subscription_update:{enabled:true,
      products:[{product:PRODUCT,prices:[state.priceIds.monthly,state.priceIds.yearly],adjustable_quantity:{enabled:false}}]}}},{idempotencyKey:MARKER+"_portal"});
  }
  const verified=await prepare(stripe,state);
  if (defaultId(verified.product)!==state.priceIds.monthly || !same(portalPrices(verified.portal),desired)) throw Error("CATALOG_VERIFICATION_FAILED");
  if (!same(verified.oldPrices,state.before.oldPrices)) throw Error("HISTORICAL_PRICE_CHANGED");
  state.subscriptionsAfter=verified.subscriptions;
  state.subscriptionsUnchanged=same(verified.subscriptions,state.before.subscriptions);
  state.pendingOperation=null;state.complete=true;state.finishedAt=new Date().toISOString();save(state);
  if (!state.subscriptionsUnchanged) throw Error("EXTERNAL_SUBSCRIPTION_CHANGE_REVIEW_REQUIRED");
  return state;
}
// Emergency configuration rollback only: no price archival and no contract mutation.
async function rollbackConfiguration(stripe, state, save) {
  if (!state || state.marker !== MARKER || state.productId !== PRODUCT || state.portalId !== PORTAL
    || !state.priceIds.monthly || !state.priceIds.yearly) throw Error("ROLLBACK_STATE_INVALID");
  const prepared = await prepare(stripe, state);
  if (!same(prepared.subscriptions, state.before.subscriptions)) throw Error("ROLLBACK_SUBSCRIPTION_CHANGE_REVIEW_REQUIRED");
  state.pendingOperation = "rollback_catalog_configuration"; save(state);
  if (defaultId(prepared.product) !== defaultId(state.before.product)) {
    if (defaultId(prepared.product) !== state.priceIds.monthly) throw Error("ROLLBACK_DEFAULT_DRIFT");
    await stripe.products.update(PRODUCT, { default_price: defaultId(state.before.product) }, { idempotencyKey: MARKER+"_rollback_default" });
  }
  const originalIds = portalPrices(state.before.portal);
  if (!same(portalPrices(prepared.portal), originalIds)) {
    if (!same(portalPrices(prepared.portal), [state.priceIds.monthly, state.priceIds.yearly].sort())) throw Error("ROLLBACK_PORTAL_DRIFT");
    await stripe.billingPortal.configurations.update(PORTAL, { features: { subscription_update: { enabled: true,
      products: [{ product: PRODUCT, prices: state.before.portal.features.subscription_update.products[0].prices, adjustable_quantity: { enabled: false } }] } } },
    { idempotencyKey: MARKER+"_rollback_portal" });
  }
  const restored = await prepare(stripe, state);
  if (defaultId(restored.product) !== defaultId(state.before.product) || !same(portalPrices(restored.portal), originalIds)
    || !same(restored.oldPrices, state.before.oldPrices) || !same(restored.subscriptions, state.before.subscriptions)) throw Error("ROLLBACK_VERIFICATION_FAILED");
  state.pendingOperation = null; state.rolledBackAt = new Date().toISOString(); state.complete = false; save(state);
  return state;
}
function privatePath(argument) {
  const directory=fs.realpathSync(path.resolve(__dirname,"../../backups"));
  const target=path.resolve(argument??path.join(directory,"felexia-essentiel-99-20261101.json"));
  const relative=path.relative(directory,fs.realpathSync(path.dirname(target)));
  if (relative.startsWith("..")||path.isAbsolute(relative)||path.extname(target)!==".json") throw Error("PRIVATE_STATE_REQUIRED");
  return target;
}
async function main() {
  require("@next/env").loadEnvConfig(path.resolve(__dirname,".."));
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) throw Error("LIVE_CONFIGURATION_REQUIRED");
  const Stripe=require("stripe"),stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:15000,maxNetworkRetries:0});
  const target=privatePath(process.argv.find(x=>x.startsWith("--state="))?.slice(8));
  const state=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,"utf8")):null;
  const prepared=await prepare(stripe,state);
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({action:"read-only-plan",productId:PRODUCT,portalId:PORTAL,defaultPrice:defaultId(prepared.product),subscriptions:prepared.subscriptions,
      prices:SPECS.map((spec,i)=>({cycle:spec.cycle,unitAmount:spec.amount,currency:"mad",interval:spec.interval,existingId:prepared.found[i]?.id??null})),noPayments:true},null,2));return;
  }
  if (!process.argv.includes("--confirm-catalog-only-live")) throw Error("CATALOG_ONLY_CONFIRMATION_REQUIRED");
  const result=await apply(stripe,prepared,state,value=>fs.writeFileSync(target,JSON.stringify(value,null,2)+"\n",{mode:0o600}));
  console.log(JSON.stringify({success:true,action:"catalog-only-applied",productId:PRODUCT,portalId:PORTAL,priceIds:result.priceIds,
    createdPriceCount:result.createdPriceIds.length,subscriptionsUnchanged:result.subscriptionsUnchanged,subscriptionCount:result.subscriptionsAfter.total,
    noPayments:true,noCheckout:true,oldPricesPreserved:true,privateState:target},null,2));
}
module.exports={PRODUCT,PORTAL,MARKER,SPECS,prepare,apply,rollbackConfiguration,priceMatches,desiredPrice,portalPrices,productInvariant,portalInvariant,subscriptionSnapshot};
if(require.main===module)main().catch(error=>{console.error(/^[A-Z0-9_]+$/.test(error.message??"")?error.message:"ESSENTIEL_REPRICE_FAILED");process.exitCode=1;});
