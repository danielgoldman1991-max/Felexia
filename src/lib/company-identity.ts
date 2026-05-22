import { createClient } from "@/lib/supabase/server";
import { getOrganizationLegalDisplay } from "@/lib/organizations/legal-display";

export interface OrganizationIdentity {
  name: string;
  logoUrl: string | null;
  ice: string | null;
  rc: string | null;
  ifNumber: string | null;
  patente: string | null;
  cnss: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  footerText: string | null;
  currency: string;
}

export async function getOrganizationDocumentIdentity(
  organizationId: string,
): Promise<OrganizationIdentity> {
  const supabase = await createClient();

  const { data: companySettings } = await supabase
    .from("company_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle();

  const nonEmpty = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const merged = {
    ...(organization ?? {}),
    ...(companySettings ?? {}),
    name: companySettings?.legal_name ?? companySettings?.commercial_name ?? organization?.name,
    logo_url: nonEmpty(organization?.logo_url) ?? nonEmpty(companySettings?.logo_url),
  };
  const legalDisplay = getOrganizationLegalDisplay(merged);

  return {
    name: legalDisplay.companyName,
    logoUrl: legalDisplay.logoUrl,
    ice: legalDisplay.ice,
    rc: legalDisplay.rc,
    ifNumber: legalDisplay.fiscalId,
    patente: companySettings?.patente ?? null,
    cnss: legalDisplay.cnss,
    address: legalDisplay.address,
    city: legalDisplay.city,
    country: companySettings?.country ?? organization?.country ?? "Maroc",
    phone: legalDisplay.phone,
    email: legalDisplay.email,
    website: companySettings?.website ?? null,
    footerText: companySettings?.footer_text ?? null,
    currency: companySettings?.currency ?? organization?.currency ?? "MAD",
  };
}
