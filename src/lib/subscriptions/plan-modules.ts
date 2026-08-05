import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PLAN_KEY, type PlanKey } from "@/lib/subscriptions/plans-config";

// Module keys are the ones stored in modules_catalog / organization_modules
// (same convention as the sidebar `moduleKey` props and the module guard layouts).
// Essentiel = crm/tiers, vente (quotes), facturation (invoicing), articles (products),
// achats (purchases), stock, tresorerie (treasury), documents.
// Business adds comptabilite (accounting, TVA incluse).
// Premium adds RH.
export const ESSENTIEL_MODULE_KEYS = [
  "dashboard",
  "crm",
  "quotes",
  "invoicing",
  "documents",
  "products",
  "purchases",
  "stock",
  "treasury",
  "users",
  "settings",
] as const;

export const BUSINESS_MODULE_KEYS = [
  ...ESSENTIEL_MODULE_KEYS,
  "accounting",
] as const;

export const PREMIUM_MODULE_KEYS = [
  ...BUSINESS_MODULE_KEYS,
  "rh",
] as const;

const MODULE_KEYS_BY_PLAN: Record<PlanKey, readonly string[]> = {
  essentiel: ESSENTIEL_MODULE_KEYS,
  business: BUSINESS_MODULE_KEYS,
  premium: PREMIUM_MODULE_KEYS,
};

export function getModulesForPlan(planKey: PlanKey): string[] {
  return [...MODULE_KEYS_BY_PLAN[planKey ?? DEFAULT_PLAN_KEY]];
}

export async function upsertModulesForPlan(
  supabase: SupabaseClient,
  organizationId: string,
  planKey: PlanKey,
): Promise<void> {
  const moduleKeys = getModulesForPlan(planKey);

  const { data: catalogRows } = await supabase
    .from("modules_catalog")
    .select("module_key")
    .in("module_key", moduleKeys);

  const validKeys = new Set((catalogRows ?? []).map((r: Record<string, unknown>) => String(r.module_key)));
  const missingKeys = moduleKeys.filter((k) => !validKeys.has(k));

  if (missingKeys.length > 0) {
    console.warn(
      `[plan-modules] Module keys missing from modules_catalog for plan '${planKey}', skipping: ${missingKeys.join(", ")}. ` +
      "Run migrations to add them.",
    );
  }

  const moduleRows = moduleKeys
    .filter((k) => validKeys.has(k))
    .map((moduleKey) => ({
      organization_id: organizationId,
      module_key: moduleKey,
      enabled: true,
      created_at: new Date().toISOString(),
    }));

  if (moduleRows.length === 0) return;

  const { error } = await supabase
    .from("organization_modules")
    .upsert(moduleRows, { onConflict: "organization_id,module_key" });

  if (error) {
    throw new Error(`Impossible d'activer les modules du plan ${planKey} : ${error.message}`);
  }
}