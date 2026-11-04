import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BillingOverview } from "@/components/settings/billing-overview";
import { hasStripeEnv } from "@/lib/env";
import { getOrganizationSubscription } from "@/lib/subscriptions/plan-access";
import { getPlanDefinition } from "@/lib/subscriptions/plans";

export default async function BillingPage() {
  const workspace = await requireActiveWorkspace();

  const supabase = await createClient();
  const [orgResult, subscription] = await Promise.all([
    supabase
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", workspace.organization.id)
      .single(),
    getOrganizationSubscription(workspace.organization.id),
  ]);

  const org = orgResult.data;
  const plan = subscription ? getPlanDefinition(subscription.planCode) : null;

  return (
    <ModulePage>
      <PageHeader title="Facturation" description="Gérez votre abonnement et vos informations de paiement." />
      <BillingOverview
        stripeCustomerId={org?.stripe_customer_id ?? subscription?.stripeCustomerId ?? null}
        subscription={subscription ? {
          id: subscription.id,
          planName: plan?.name ?? "Inconnu",
          planSlug: subscription.planCode,
          status: subscription.status,
          billingInterval: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEnd: subscription.trialEndsAt,
          canceledAt: subscription.cancelAtPeriodEnd ? subscription.currentPeriodEnd : null,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
        } : null}
        hasStripe={hasStripeEnv()}
      />
    </ModulePage>
  );
}
