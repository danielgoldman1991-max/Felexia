import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { SubscriptionManage } from "@/components/settings/subscription-manage";
import { hasStripeEnv } from "@/lib/env";
import { getOrganizationSubscription } from "@/lib/subscriptions/plan-access";

export default async function AbonnementPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const [subscription, memberResult, documentsResult, storageResult] = await Promise.all([
    getOrganizationSubscription(workspace.organization.id),
    supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", workspace.organization.id)
      .eq("status", "active"),
    supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", workspace.organization.id)
      .gte("created_at", monthStart),
    supabase
      .from("documents")
      .select("size_bytes")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null),
  ]);

  const memberCount = memberResult.count ?? 0;
  const documentsThisMonth = documentsResult.count ?? 0;
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
        nowIso={new Date().toISOString()}
      />
    </div>
  );
}
