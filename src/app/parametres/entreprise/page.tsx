import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";

export default async function CompanyPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();

  const isOwner = workspace.role === "owner" || workspace.role === "admin";

  return (
    <div>
      <PageHeader title="Entreprise" description="Informations légales et coordonnées de votre société." />
      <CompanySettingsForm
        settings={company}
        canEdit={isOwner}
      />
    </div>
  );
}
