/* eslint-disable @typescript-eslint/no-require-imports -- isolated real-handler compatibility fixture */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { SPECS } = require("../../../scripts/reprice-essentiel-99.cjs");
const env = { STRIPE_PRICE_ESSENTIEL_MONTHLY: "price_new_monthly", STRIPE_PRICE_ESSENTIEL_YEARLY: "price_new_yearly", STRIPE_WEBHOOK_SECRET: "isolated_fixture" };
function compile(relative, mocks = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, "../../../", relative), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const ctx = { exports: {}, process: { env }, console, require: name => { if (!(name in mocks)) throw Error("UNEXPECTED_IMPORT_"+name); return mocks[name]; } };
  vm.runInNewContext(js, ctx); return ctx.exports;
}
const mapping = compile("src/lib/subscriptions/stripe-prices.ts");
let checks = 0;
async function main() {
  for (const spec of SPECS) {
    for (const type of ["checkout.session.completed", "invoice.paid", "invoice.payment_succeeded", "customer.subscription.updated"]) {
      const persisted = [];
      const subscription = { id: "sub_fixture_legacy", customer: "cus_fixture", status: "active", metadata: { organization_id: "org_fixture" },
        current_period_start: 1793481600, current_period_end: spec.cycle === "monthly" ? 1796073600 : 1825017600,
        items: { data: [{ price: { id: spec.oldId, unit_amount: spec.oldAmount, currency: "mad", recurring: { interval: spec.interval } } }] } };
      const before = JSON.stringify(subscription);
      const service = { rpc: async (name, args) => { if (name === "claim_stripe_event") return { data: "claimed", error: null };
        assert.equal(name, "apply_stripe_subscription"); persisted.push(args); return { data: true, error: null }; },
        from: name => { assert.equal(name, "stripe_events"); return { update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: { id: "evt_fixture" }, error: null }) }) }) }) }; } };
      const stripe = { webhooks: { constructEvent: body => JSON.parse(body) }, subscriptions: { retrieve: async id => { assert.equal(id, subscription.id); return subscription; } } };
      const handler = compile("src/lib/stripe-webhook.ts", { "@/lib/stripe": { getStripe: () => stripe }, "@/lib/subscriptions/plans": { normalizePlanCode: v => v },
        "@/lib/subscriptions/stripe-prices": mapping, "@/lib/supabase/service": { createClient: () => service } });
      const object = type === "checkout.session.completed" ? { mode: "subscription", subscription: subscription.id, metadata: { organization_id: "org_fixture" } }
        : type === "invoice.paid" ? { parent: { subscription_details: { subscription: subscription.id } } }
        : type === "invoice.payment_succeeded" ? { subscription: subscription.id } : { id: subscription.id };
      const result = await handler.handleStripeWebhook(JSON.stringify({ id: "evt_fixture", type, created: 1793481601, data: { object } }), "isolated_signature");
      assert.equal(result.received, true); checks++;
      assert.equal(persisted.length, 1); checks++;
      assert.equal(persisted[0].p_payload.plan_code, "essentiel"); checks++;
      assert.equal(persisted[0].p_payload.billing_cycle, spec.cycle); checks++;
      assert.equal(Object.keys(persisted[0].p_payload).some(k => /amount|price|currency/.test(k)), false, "catalogue price changes cannot replace historical contract amounts"); checks++;
      assert.equal(JSON.stringify(subscription), before, "the source Stripe contract and old amount remain exact"); checks++;
    }
  }
  console.log(JSON.stringify({ passed: checks, events: 8, realHandler: true, realReverseMapping: true, externalNetwork: false, payments: false }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
