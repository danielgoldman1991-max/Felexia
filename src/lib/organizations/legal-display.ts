export type OrganizationLegalDisplay = {
  companyName: string;
  legalName: string | null;
  ice: string | null;
  fiscalId: string | null;
  rc: string | null;
  villeRc: string | null;
  cnss: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
};

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getOrganizationLegalDisplay(organization: Record<string, unknown> | null | undefined): OrganizationLegalDisplay {
  const legalName = nonEmpty(organization?.legal_name);
  const name = legalName ?? nonEmpty(organization?.commercial_name) ?? nonEmpty(organization?.name) ?? "";

  return {
    companyName: name,
    legalName,
    ice: nonEmpty(organization?.ice),
    fiscalId: nonEmpty(organization?.if_number) ?? nonEmpty(organization?.tax_identifier),
    rc: nonEmpty(organization?.rc),
    villeRc: nonEmpty(organization?.ville_rc),
    cnss: nonEmpty(organization?.cnss),
    address: nonEmpty(organization?.address),
    city: nonEmpty(organization?.city),
    phone: nonEmpty(organization?.phone),
    email: nonEmpty(organization?.email),
    logoUrl: nonEmpty(organization?.logo_url),
  };
}
