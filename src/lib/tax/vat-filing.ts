import type { VatRegimeMode } from "@/lib/tax/vat-period-rules";
import { createClient } from "@/lib/supabase/server";

export type OrganizationVatFiling = {
  frequency: "monthly" | "quarterly";
  regime: VatRegimeMode;
};

const FREQUENCIES = new Set(["monthly", "quarterly"]);
const REGIMES = new Set(["encaissement", "debit", "mixed", "unspecified"]);

export function normalizeVatFiling(value: { vat_frequency?: string | null; vat_regime?: string | null } | null | undefined): OrganizationVatFiling {
  return {
    frequency: FREQUENCIES.has(String(value?.vat_frequency)) ? value!.vat_frequency as "monthly" | "quarterly" : "monthly",
    regime: REGIMES.has(String(value?.vat_regime)) ? value!.vat_regime as VatRegimeMode : "unspecified",
  };
}

/** Lecture limitée à la périodicité et au régime. Les autres paramètres de dépôt restent PRO. */
export async function readOrganizationVatFiling(organizationId: string): Promise<OrganizationVatFiling> {
  const supabase = await createClient();
  const filing = await supabase.rpc("get_organization_vat_filing", { p_organization_id: organizationId });
  const row = Array.isArray(filing.data) ? filing.data[0] : filing.data;
  if (!filing.error && row) return normalizeVatFiling(row as { vat_frequency?: string | null; vat_regime?: string | null });
  const legacy = await supabase
    .from("organization_fiscal_settings")
    .select("vat_frequency")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!legacy.error && legacy.data) return normalizeVatFiling(legacy.data);
  return { frequency: "monthly", regime: "unspecified" };
}
