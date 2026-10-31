import "server-only";

/** Only deployment operators can enable the complete interface for an organisation. */
export async function hasFullErpAccess(organizationId: string): Promise<boolean> {
  if (process.env.FELEXIA_ERP_MODE?.trim().toLowerCase() === "full") return true;
  if (!organizationId) return false;
  const enabledOrganizations = (process.env.FELEXIA_FULL_ERP_ORGANIZATION_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  return enabledOrganizations.includes(organizationId.toLowerCase());
}
