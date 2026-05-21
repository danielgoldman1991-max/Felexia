import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { SubscriptionManage } from "@/components/settings/subscription-manage";
import { hasStripeEnv } from "@/lib/env";

export default async function AbonnementPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const [subResult, memberResult, documentsResult, storageResult] = await Promise.all([
    supabase
      .from("organization_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("organization_id", workspace.organization.id)
      .limit(1)
      .maybeSingle(),
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

  const subscription = subResult.data;
  const memberCount = memberResult.count ?? 0;
  const documentsThisMonth = documentsResult.count ?? 0;
  const storageUsedMb = Math.ceil(
    ((storageResult.data ?? []).reduce((total, row) => total + Number(row.size_bytes ?? 0), 0)) / 1024 / 1024,
  );

  return (
    <div>
      <PageHeader title="Abonnement" description="Gérez votre pack Felexia, vos limites et votre facturation." />
      <SubscriptionManage
        currentSubscription={subscription as Record<string, unknown> | null}
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
