/* Targeted, read-only subscription metadata. No IDs, names, contact details or credentials are retained. */
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await client.from('organization_subscriptions').select('id,organization_id,status,plan_code,current_period_start,current_period_end,stripe_subscription_id,stripe_customer_id,created_at,trial_ends_at,trial_end').eq('status', 'active').is('current_period_end', null);
  if (error) throw Error('Read unavailable');
  const report = { at: new Date().toISOString(), scope: 'Only the uniquely anomalous contract and its organization Stripe reference are queried. No names, IDs, emails or secrets are saved. No mutations.', anomalyRows: rows.length, uniqueCanonical: false, classification: 'undetermined', stripe: { configured: Boolean(process.env.STRIPE_SECRET_KEY), readAttempted: false }, repairExecuted: false };
  if (rows.length === 1) {
    const row = rows[0];
    const { data: latest, error: latestError } = await client.from('organization_subscriptions').select('id').eq('organization_id', row.organization_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (latestError) throw Error('Canonical read unavailable');
    report.uniqueCanonical = latest?.id === row.id;
    report.contract = { status: row.status, planCode: row.plan_code, hasCurrentPeriodStart: Boolean(row.current_period_start), hasCurrentPeriodEnd: Boolean(row.current_period_end), hasTrialEnd: Boolean(row.trial_ends_at ?? row.trial_end), hasStripeSubscriptionReference: Boolean(row.stripe_subscription_id), hasStripeCustomerReference: Boolean(row.stripe_customer_id) };
    const { data: company, error: companyError } = await client.from('organizations').select('stripe_customer_id').eq('id', row.organization_id).single();
    if (companyError) throw Error('Company Stripe reference unavailable');
    report.companyHasStripeCustomerReference = Boolean(company.stripe_customer_id);
    const customerId = row.stripe_customer_id || company.stripe_customer_id;
    if ((row.stripe_subscription_id || customerId) && process.env.STRIPE_SECRET_KEY) {
      report.stripe.readAttempted = true;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-08-27', maxNetworkRetries: 0 });
      let subscription;
      if (row.stripe_subscription_id) subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id, { expand: ['latest_invoice'] });
      else {
        const found = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100, expand: ['data.latest_invoice'] });
        const live = found.data.filter(item => !['canceled', 'incomplete_expired'].includes(item.status));
        report.stripe.nonFinalSubscriptions = live.length;
        report.stripe.listComplete = !found.has_more;
        if (live.length === 1 && !found.has_more) subscription = live[0];
      }
      if (subscription) {
        const matchingOrganization = subscription.metadata?.organization_id === row.organization_id;
        const matchingCustomer = !customerId || (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id) === customerId;
        const periodEnd = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end;
        const invoice = typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null;
        report.stripe.subscription = { status: subscription.status, liveMode: subscription.livemode, matchingOrganization, matchingCustomer, hasValidPeriodEnd: Number.isFinite(periodEnd) && periodEnd > 0, periodEndIsFuture: Number.isFinite(periodEnd) && periodEnd * 1000 > Date.now(), latestInvoicePositiveAmountPaid: Boolean(invoice?.paid && invoice.amount_paid > 0) };
        if (matchingOrganization && matchingCustomer && subscription.livemode && invoice?.paid && invoice.amount_paid > 0) report.classification = 'paid_customer_proven_by_linked_positive_paid_live_invoice';
      }
    }
    if (!row.stripe_subscription_id && !customerId) report.stripe.reason = 'No Stripe subscription or customer reference in the contract or company. No Stripe-wide lookup attempted.';
    report.repairPlan = report.stripe.subscription?.matchingOrganization && report.stripe.subscription?.matchingCustomer && report.stripe.subscription?.hasValidPeriodEnd
      ? 'Prepare exact status and dates from the verified Stripe subscription, then obtain root confirmation before any repair. No dates were written.'
      : 'No automatic repair is justified. Qualify the original contract privately with the owner, obtain its real dates/status or establish QA/historical provenance. Preserve read access and do not invent an expiry.';
  }
  fs.writeFileSync(path.join(__dirname, 'undated-contract-qualification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
main().catch(() => { console.error('Targeted read-only contract qualification unavailable; no private details or credentials logged. No mutation attempted.'); process.exitCode = 1; });
