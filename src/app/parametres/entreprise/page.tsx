import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";

function canManageCompanySettings(roleName: string | null): boolean {
  if (!roleName) return false;
  const normalized = roleName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return ["owner", "admin", "administrator", "administrateur"].includes(normalized);
}

export default async function CompanyPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("company_settings")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", workspace.organization.id)
    .maybeSingle();

  const nonEmpty = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const settings = {
    ...(organization ?? {}),
    ...(company ?? {}),
    logo_url: nonEmpty(organization?.logo_url) ?? nonEmpty(company?.logo_url),
    logo_path: nonEmpty(organization?.logo_path) ?? nonEmpty(company?.logo_path),
  };

  const isOwner = canManageCompanySettings(workspace.role);

  return (
    <div>
      <PageHeader title="Entreprise" description="Informations légales et coordonnées de votre société." />
      <CompanySettingsForm
        settings={settings}
        canEdit={isOwner}
      />
    </div>
  );
}
