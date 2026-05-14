import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { DocumentSettingsForm } from "@/components/settings/document-settings-form";

export default async function DocumentsPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: docSettings } = await supabase
    .from("document_settings")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();

  const isAdmin = workspace.role === "owner" || workspace.role === "admin";

  return (
    <div>
      <PageHeader title="Documents commerciaux" description="Préfixes, numérotation et mentions légales sur vos PDF." />
      <DocumentSettingsForm
        settings={docSettings as Record<string, unknown> | null}
        canEdit={isAdmin}
      />
    </div>
  );
}
