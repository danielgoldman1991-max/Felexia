import "server-only";
import { requireActiveWorkspace } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import type { NumberingSettingsData } from "@/lib/numbering-types";
import { currentNumberingPeriod, isNumberingCounterAllowed, isNumberingMigrationMissing, numberingPeriodLabel, parseNumberingPeriod, toNumberingCounter, NUMBERING_ADMIN_ERROR, NUMBERING_ACTIVATION_MESSAGE } from "@/lib/numbering-model";

export async function getNumberingSettings(period?: string): Promise<NumberingSettingsData> {
  const workspace = await requireActiveWorkspace();
  const selectedPeriod = parseNumberingPeriod(period) ?? currentNumberingPeriod();
  const base: NumberingSettingsData = { counters: [], canEdit: isAdminRole(workspace.role), migrationReady: false, selectedPeriod, periodLabel: numberingPeriodLabel(selectedPeriod) };
  if (!base.canEdit) return { ...base, error: NUMBERING_ADMIN_ERROR };
  const supabase = await createClient();
  const [{ data, error }, fullAccess] = await Promise.all([
    supabase.rpc("get_numbering_counters", { p_organization_id: workspace.organization.id, p_period: `${selectedPeriod}-01` }),
    hasFullErpAccess(workspace.organization.id),
  ]);
  if (error) {
    if (isNumberingMigrationMissing(error)) return { ...base, error: NUMBERING_ACTIVATION_MESSAGE };
    console.error("[numbering] counter read failed", { code: error.code, organizationId: workspace.organization.id });
    return { ...base, error: "Les compteurs sont momentanément indisponibles. Réessayez dans un instant." };
  }
  try {
    if (!Array.isArray(data)) throw new Error("Invalid counter list");
    return { ...base, migrationReady: true, counters: data.map(toNumberingCounter).filter((counter) => isNumberingCounterAllowed(counter.key, fullAccess)) };
  } catch {
    console.error("[numbering] unsupported counter response", { organizationId: workspace.organization.id });
    return { ...base, error: "Les compteurs ne peuvent pas être affichés. Contactez l’équipe Felexia." };
  }
}
