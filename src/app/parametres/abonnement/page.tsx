import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { SubscriptionManage } from "@/components/settings/subscription-manage";
import { hasStripeEnv } from "@/lib/env";
import { getOrganizationSubscription } from "@/lib/subscriptions/plan-access";
import { isAdminRole } from "@/lib/auth/roles";
import { resolvePublicPlanCode } from "@/lib/subscriptions/commercial-offers";

export default async function AbonnementPage({ searchParams }: { searchParams: Promise<{ plan?: string; billing?: string }> }) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const selection = await searchParams;

  const [subscription, memberResult, documentsResult, storageResult] = await Promise.all([
    getOrganizationSubscription(workspace.organization.id, { throwOnError: true }),
    supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", workspace.organization.id)
      .eq("status", "active"),
    supabase.rpc("get_commercial_document_usage", { p_organization_id: workspace.organization.id }),
    supabase
      .from("documents")
      .select("size_bytes")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null),
  ]);

  if (memberResult.error || documentsResult.error || storageResult.error) {
    return <div><PageHeader title="Abonnement" description="Votre offre et votre utilisation." /><div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Votre utilisation n’a pas pu être chargée. Actualisez cette page dans quelques instants ; aucun essai n’a été recréé.</div></div>;
  }
  const memberCount = memberResult.count ?? 0;
  const documentsThisMonth = Number(documentsResult.data ?? 0);
  const storageUsedMb = Math.ceil(
    ((storageResult.data ?? []).reduce((total, row) => total + Number(row.size_bytes ?? 0), 0)) / 1024 / 1024,
  );

  return (
    <div>
      <PageHeader title="Abonnement" description="Gérez votre pack Felexia, vos limites et votre facturation." />
      <SubscriptionManage
        currentSubscription={subscription ? {
          id: subscription.id,
          plan_code: subscription.planCode,
          status: subscription.status,
          billing_cycle: subscription.billingCycle,
          current_period_start: subscription.currentPeriodStart,
          current_period_end: subscription.currentPeriodEnd,
          trial_ends_at: subscription.trialEndsAt,
          cancel_at_period_end: subscription.cancelAtPeriodEnd,
          stripe_customer_id: subscription.stripeCustomerId,
          stripe_subscription_id: subscription.stripeSubscriptionId,
        } : null}
        organizationId={workspace.organization.id}
        memberCount={memberCount}
        documentsThisMonth={documentsThisMonth}
        storageUsedMb={storageUsedMb}
        hasStripe={hasStripeEnv()}
        canManageBilling={isAdminRole(workspace.role)}
        nowIso={new Date().toISOString()}
        selectedPlan={resolvePublicPlanCode(selection.plan)}
        initialBillingInterval={selection.billing === "yearly" ? "yearly" : "monthly"}
      />
    </div>
  );
}
