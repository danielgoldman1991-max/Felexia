import { createClient as createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const GLOBAL_TAX_RATE_CODES = ["VAT_0", "VAT_7", "VAT_10", "VAT_14", "VAT_20", "VAT_EXEMPT"] as const;

const SEED_RATES: Array<{
  code: string;
  name: string;
  label: string;
  rate: number;
  is_default: boolean;
  sort_order: number;
}> = [
  { code: "VAT_0", name: "0 %", label: "0 %", rate: 0, is_default: false, sort_order: 1 },
  { code: "VAT_7", name: "7 %", label: "7 %", rate: 7, is_default: false, sort_order: 2 },
  { code: "VAT_10", name: "10 %", label: "10 %", rate: 10, is_default: false, sort_order: 3 },
  { code: "VAT_14", name: "14 %", label: "14 %", rate: 14, is_default: false, sort_order: 4 },
  { code: "VAT_20", name: "20 %", label: "20 %", rate: 20, is_default: true, sort_order: 5 },
  { code: "VAT_EXEMPT", name: "Exonéré", label: "Exonéré", rate: 0, is_default: false, sort_order: 6 },
];

export type TaxReferenceRate = {
  id: string;
  code: string;
  name: string;
  label: string | null;
  rate: number;
  is_default: boolean;
  sort_order: number;
};

/**
 * Garantit la présence des 6 taux TVA globaux (référentiel unique, is_system).
 * Idempotente : ne réinsère que les codes manquants et rétablit VAT_20 comme
 * seul is_default. Exécutée côté service role (bypass RLS) par les actions
 * serveur lorsque la lecture session ne renvoie rien.
 */
export async function ensureTaxReferenceData(): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("tax_rates")
    .select("code")
    .is("organization_id", null)
    .eq("is_system", true)
    .in("code", [...GLOBAL_TAX_RATE_CODES]);

  const known = new Set((existing ?? []).map((row) => row.code as string));

  for (const seed of SEED_RATES) {
    if (known.has(seed.code)) continue;
    await supabase.from("tax_rates").insert({
      organization_id: null,
      name: seed.name,
      label: seed.label,
      rate: seed.rate,
      code: seed.code,
      is_default: seed.is_default,
      is_active: true,
      is_system: true,
      sort_order: seed.sort_order,
      status: "active",
      description: seed.code === "VAT_EXEMPT" ? "Exonéré de TVA" : `TVA ${seed.name}`,
    });
  }

  await supabase
    .from("tax_rates")
    .update({ is_default: false })
    .is("organization_id", null)
    .eq("is_system", true)
    .in("code", [...GLOBAL_TAX_RATE_CODES])
    .neq("code", "VAT_20");
  await supabase
    .from("tax_rates")
    .update({ is_default: true })
    .is("organization_id", null)
    .eq("is_system", true)
    .eq("code", "VAT_20");
}

/**
 * Lecture des taux globaux via la session utilisateur (RLS appliquée).
 * Retourne [] si la session ne peut pas les voir (ex. garde RLS non migrée).
 */
export async function getGlobalTaxRatesForReference(): Promise<TaxReferenceRate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tax_rates")
    .select("id, code, name, label, rate, is_default, sort_order")
    .is("organization_id", null)
    .eq("status", "active")
    .eq("is_system", true)
    .in("code", [...GLOBAL_TAX_RATE_CODES])
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []) as TaxReferenceRate[];
}

/**
 * Taux TVA par défaut (20 % selon le référentiel) : is_default VAT_20, sinon
 * premier taux is_default, sinon VAT_20 par code, sinon premier trié.
 * Réessaye après ensureTaxReferenceData si la lecture session était vide.
 */
export async function resolveDefaultTaxRate(): Promise<{ id: string; rate: number } | null> {
  let rates = await getGlobalTaxRatesForReference();
  if (rates.length === 0) {
    await ensureTaxReferenceData();
    rates = await getGlobalTaxRatesForReference();
  }
  if (rates.length === 0) return null;

  const resolved =
    rates.find((rate) => rate.is_default && rate.code === "VAT_20") ??
    rates.find((rate) => rate.is_default) ??
    rates.find((rate) => rate.code === "VAT_20") ??
    rates[0];

  return { id: resolved.id, rate: Number(resolved.rate) };
}

/** Identifiant du taux par défaut (ou null si aucun taux actif). */
export async function resolveDefaultTaxRateId(): Promise<string | null> {
  const resolved = await resolveDefaultTaxRate();
  return resolved?.id ?? null;
}
