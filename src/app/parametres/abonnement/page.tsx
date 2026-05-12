import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { SubscriptionManage } from "@/components/settings/subscription-manage";
import { hasStripeEnv } from "@/lib/env";

export default async function AbonnementPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const [subResult, plansResult] = await Promise.all([
    supabase
      .from("organization_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("organization_id", workspace.organization.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order"),
  ]);

  const subscription = subResult.data;
  const plans = plansResult.data ?? [];

  const { count } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", workspace.organization.id)
    .eq("status", "active");

  const memberCount = count ?? 0;

  return (
    <div>
      <PageHeader title="Abonnement" description="Gérez votre formule et les limites de votre organisation." />
      <SubscriptionManage
        currentSubscription={subscription as Record<string, unknown> | null}
        plans={plans as Record<string, unknown>[]}
        organizationId={workspace.organization.id}
        memberCount={memberCount}
        hasStripe={hasStripeEnv()}
      />
    </div>
  );
}
