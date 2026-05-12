import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { PageHeader } from "@/components/erp/page-header";
import { SecuritySettings } from "@/components/settings/security-settings";

export default async function SecuritePage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user?.id)
    .single();

  const { data: recentLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <PageHeader title="Sécurité" description="Mot de passe, sessions et journal d'activité." />
      <SecuritySettings
        userEmail={profile?.email ?? user?.email ?? ""}
        userName={profile?.full_name ?? ""}
        auditLogs={recentLogs as Record<string, unknown>[]}
      />
    </div>
  );
}
