import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/erp/page-header";
import {
  CompanySettingsForm,
  type CompanySettingsFormValues,
} from "@/components/settings/company-settings-form";

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

  const { data: company, error: companyError } = await supabase
    .from("company_settings")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();

  if (companyError) {
    console.error("Company settings load error:", companyError.message);
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", workspace.organization.id)
    .maybeSingle();

  if (organizationError) {
    console.error("Organization settings load error:", organizationError.message);
  }

  const nonEmpty = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const textValue = (value: unknown, fallback = "") => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return fallback;
  };

  const dateValue = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toISOString();
    }
    return null;
  };

  const safeSettings: CompanySettingsFormValues = {
    id: textValue(organization?.id ?? company?.id),
    organization_id: textValue(company?.organization_id ?? organization?.id ?? workspace.organization.id),
    name: textValue(organization?.name),
    legal_name: textValue(company?.legal_name ?? organization?.legal_name ?? organization?.name),
    commercial_name: textValue(company?.commercial_name ?? organization?.commercial_name),
    forme_juridique: textValue(company?.forme_juridique ?? organization?.forme_juridique),
    ice: textValue(company?.ice ?? organization?.ice),
    rc: textValue(company?.rc ?? organization?.rc),
    ville_rc: textValue(company?.ville_rc ?? organization?.ville_rc),
    if_number: textValue(company?.if_number ?? organization?.if_number),
    cnss: textValue(company?.cnss ?? organization?.cnss),
    patente: textValue(company?.patente ?? organization?.patente),
    tax_identifier: textValue(company?.tax_identifier ?? organization?.tax_identifier),
    activity: textValue(company?.activity ?? organization?.activity),
    address: textValue(company?.address ?? organization?.address),
    city: textValue(company?.city ?? organization?.city),
    country: textValue(company?.country ?? organization?.country, "Maroc"),
    phone: textValue(company?.phone ?? organization?.phone),
    email: textValue(company?.email ?? organization?.email),
    website: textValue(company?.website ?? organization?.website),
    currency: textValue(company?.currency ?? organization?.currency, "MAD"),
    footer_text: textValue(company?.footer_text ?? organization?.footer_text),
    logo_url: nonEmpty(organization?.logo_url) ?? nonEmpty(company?.logo_url) ?? "",
    logo_path: nonEmpty(organization?.logo_path) ?? nonEmpty(company?.logo_path) ?? "",
    updated_at: dateValue(company?.updated_at ?? organization?.updated_at),
  };

  const isOwner = canManageCompanySettings(workspace.role);

  return (
    <div>
      <PageHeader title="Entreprise" description="Informations légales et coordonnées de votre société." />
      <CompanySettingsForm
        settings={safeSettings}
        canEdit={isOwner}
      />
    </div>
  );
}
