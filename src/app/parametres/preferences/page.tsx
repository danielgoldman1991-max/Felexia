import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { UserPreferencesForm } from "@/components/settings/user-preferences-form";

export default async function PreferencesPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", workspace.userId)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();

  return (
    <div>
      <PageHeader title="Préférences" description="Langue, thème et affichage de l'interface." />
      <UserPreferencesForm
        userId={workspace.userId}
        organizationId={workspace.organization.id}
        preferences={prefs as Record<string, unknown> | null}
      />
    </div>
  );
}
