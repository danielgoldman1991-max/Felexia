import { createClient } from "@/lib/supabase/server";

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

  const logoUrl = nonEmpty(organization?.logo_url) ?? nonEmpty(companySettings?.logo_url);

  const name =
    companySettings?.legal_name ??
    companySettings?.commercial_name ??
    organization?.name ??
    "";

  return {
    name,
    logoUrl,
    ice: companySettings?.ice ?? organization?.ice ?? null,
    rc: companySettings?.rc ?? organization?.rc ?? null,
    ifNumber: companySettings?.if_number ?? organization?.if_number ?? null,
    patente: companySettings?.patente ?? null,
    cnss: companySettings?.cnss ?? null,
    address: companySettings?.address ?? organization?.address ?? null,
    city: companySettings?.city ?? organization?.city ?? null,
    country: companySettings?.country ?? organization?.country ?? "Maroc",
    phone: companySettings?.phone ?? organization?.phone ?? null,
    email: companySettings?.email ?? organization?.email ?? null,
    website: companySettings?.website ?? null,
    footerText: companySettings?.footer_text ?? null,
    currency: companySettings?.currency ?? organization?.currency ?? "MAD",
  };
}
