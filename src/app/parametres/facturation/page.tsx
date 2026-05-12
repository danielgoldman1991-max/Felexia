import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BillingOverview } from "@/components/settings/billing-overview";
import { hasStripeEnv } from "@/lib/env";

export default async function BillingPage() {
  const workspace = await requireActiveWorkspace();

  const supabase = await createClient();
  const [orgResult, subscriptionResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", workspace.organization.id)
      .single(),
    supabase
      .from("organization_subscriptions")
      .select("*, plan:subscription_plans(name, slug, features)")
      .eq("organization_id", workspace.organization.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const org = orgResult.data;
  const subscription = subscriptionResult.data as {
    id: string;
    plan_id: string;
    status: string;
    billing_interval: string;
    current_period_start: string | null;
    current_period_end: string | null;
    trial_start: string | null;
    trial_end: string | null;
    canceled_at: string | null;
    stripe_subscription_id: string | null;
    plan: { name: string; slug: string; features: string[] } | null;
  } | null;

  return (
    <ModulePage>
      <PageHeader title="Facturation" description="Gerer votre abonnement et vos informations de paiement." />
      <BillingOverview
        stripeCustomerId={org?.stripe_customer_id ?? null}
        subscription={subscription ? {
          id: subscription.id,
          planName: subscription.plan?.name ?? "Inconnu",
          planSlug: subscription.plan?.slug ?? "",
          status: subscription.status,
          billingInterval: subscription.billing_interval,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          trialEnd: subscription.trial_end,
          canceledAt: subscription.canceled_at,
          stripeSubscriptionId: subscription.stripe_subscription_id,
        } : null}
        hasStripe={hasStripeEnv()}
      />
    </ModulePage>
  );
}
