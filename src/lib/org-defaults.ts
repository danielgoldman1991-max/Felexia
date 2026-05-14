import { createClient } from "@/lib/supabase/service";

export async function initializeOrganizationDefaults(organizationId: string) {
  const svc = createClient();

  // Customer categories (3 defaults)
  await svc.from("customer_categories").upsert([
    { organization_id: organizationId, name: "Client Comptoir", description: "Client comptoir / vente directe", is_default: true },
    { organization_id: organizationId, name: "Particulier", description: "Client particulier", is_default: true },
    { organization_id: organizationId, name: "Grand Compte", description: "Grand compte / entreprise", is_default: true },
  ], { onConflict: "organization_id,name", ignoreDuplicates: true });

  // Item categories — new table (7 defaults)
  await svc.from("item_categories").upsert([
    { organization_id: organizationId, code: "PF", name: "Produits finis", description: "Produits finis" },
    { organization_id: organizationId, code: "MP", name: "Matières premières", description: "Matières premières" },
    { organization_id: organizationId, code: "PDR", name: "Pièces de rechange", description: "Pièces de rechange" },
    { organization_id: organizationId, code: "CON", name: "Consommables", description: "Consommables" },
    { organization_id: organizationId, code: "MOB", name: "Mobilier", description: "Mobilier" },
    { organization_id: organizationId, code: "INF", name: "Matériel informatique", description: "Matériel informatique" },
    { organization_id: organizationId, code: "FDB", name: "Fourniture de bureau", description: "Fourniture de bureau" },
  ], { onConflict: "organization_id,code", ignoreDuplicates: true });

  // Item units — new table (12 defaults)
  await svc.from("item_units").upsert([
    { organization_id: organizationId, code: "U", name: "Unité" },
    { organization_id: organizationId, code: "PCS", name: "Pièce" },
    { organization_id: organizationId, code: "KG", name: "Kilogramme" },
    { organization_id: organizationId, code: "G", name: "Gramme" },
    { organization_id: organizationId, code: "L", name: "Litre" },
    { organization_id: organizationId, code: "M", name: "Mètre" },
    { organization_id: organizationId, code: "M2", name: "Mètre carré" },
    { organization_id: organizationId, code: "M3", name: "Mètre cube" },
    { organization_id: organizationId, code: "H", name: "Heure" },
    { organization_id: organizationId, code: "J", name: "Jour" },
    { organization_id: organizationId, code: "LOT", name: "Lot" },
    { organization_id: organizationId, code: "BOITE", name: "Boîte" },
  ], { onConflict: "organization_id,code", ignoreDuplicates: true });

  // Legacy product_categories (7 defaults) — for backward compat with existing UI
  await svc.from("product_categories").upsert([
    { organization_id: organizationId, code: "PF", name: "Produits finis", description: "Produits finis", type: "product", status: "active" },
    { organization_id: organizationId, code: "MP", name: "Matières premières", description: "Matières premières", type: "product", status: "active" },
    { organization_id: organizationId, code: "PDR", name: "Pièces de rechange", description: "Pièces de rechange", type: "product", status: "active" },
    { organization_id: organizationId, code: "CON", name: "Consommables", description: "Consommables", type: "product", status: "active" },
    { organization_id: organizationId, code: "MOB", name: "Mobilier", description: "Mobilier", type: "product", status: "active" },
    { organization_id: organizationId, code: "INF", name: "Matériel informatique", description: "Matériel informatique", type: "product", status: "active" },
    { organization_id: organizationId, code: "FDB", name: "Fourniture de bureau", description: "Fourniture de bureau", type: "product", status: "active" },
  ], { onConflict: "organization_id,name", ignoreDuplicates: true });

  // Legacy units (12 defaults) — for backward compat with existing UI
  await svc.from("units").upsert([
    { organization_id: organizationId, name: "Unité", symbol: "U", status: "active" },
    { organization_id: organizationId, name: "Pièce", symbol: "PCS", status: "active" },
    { organization_id: organizationId, name: "Kilogramme", symbol: "KG", status: "active" },
    { organization_id: organizationId, name: "Gramme", symbol: "G", status: "active" },
    { organization_id: organizationId, name: "Litre", symbol: "L", status: "active" },
    { organization_id: organizationId, name: "Mètre", symbol: "M", status: "active" },
    { organization_id: organizationId, name: "Mètre carré", symbol: "M2", status: "active" },
    { organization_id: organizationId, name: "Mètre cube", symbol: "M3", status: "active" },
    { organization_id: organizationId, name: "Heure", symbol: "H", status: "active" },
    { organization_id: organizationId, name: "Jour", symbol: "J", status: "active" },
    { organization_id: organizationId, name: "Lot", symbol: "LOT", status: "active" },
    { organization_id: organizationId, name: "Boîte", symbol: "BOITE", status: "active" },
  ], { onConflict: "organization_id,symbol", ignoreDuplicates: true });
}
