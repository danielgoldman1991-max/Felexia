import { createClient } from "@/lib/supabase/service";
import { DEFAULT_ACCOUNTING_JOURNALS, DEFAULT_CHART_OF_ACCOUNTS } from "@/lib/accounting";
import { DEFAULT_CUSTOMER_CATEGORIES, DEFAULT_PRODUCT_CATEGORIES, DEFAULT_UNITS } from "@/lib/reference-lists";

/** Called only on the server with an organisation created for the current user. */
export async function initializeOrganizationDefaults(organizationId: string) {
  const svc = createClient();
  const errors: string[] = [];
  const check = (label: string, result: { error: { message: string } | null }) => {
    if (result.error) errors.push(`${label}: ${result.error.message}`);
  };

  // Seed safe invitation choices first. A failure in optional reference data
  // must not leave the only available invitation role as administrator.
  const roleResult = await svc.from("roles").upsert([
    { organization_id: organizationId, name: "viewer", description: "Consultation des données de l’entreprise." },
    { organization_id: organizationId, name: "sales", description: "Gestion des clients, factures de vente et règlements." },
    { organization_id: organizationId, name: "accountant", description: "Suivi des factures, règlements et journaux comptables." },
  ], { onConflict: "organization_id,name", ignoreDuplicates: true });
  check("Rôles", roleResult);

  const referenceResults = await Promise.all([
    svc.from("customer_categories").upsert(DEFAULT_CUSTOMER_CATEGORIES.map((cat) => ({
      organization_id: organizationId, name: cat.name, description: cat.description, is_default: cat.is_default,
    })), { onConflict: "organization_id,name", ignoreDuplicates: true }),
    svc.from("product_categories").upsert(DEFAULT_PRODUCT_CATEGORIES.map((cat) => ({
      organization_id: organizationId, code: cat.code, name: cat.name, description: cat.description, type: cat.type, status: "active",
    })), { onConflict: "organization_id,name", ignoreDuplicates: true }),
    svc.from("units").upsert(DEFAULT_UNITS.map((unit) => ({
      organization_id: organizationId, name: unit.name, symbol: unit.symbol, description: unit.description, status: "active",
    })), { onConflict: "organization_id,symbol", ignoreDuplicates: true }),
  ]);
  referenceResults.forEach((result, index) => check(["Catégories clients", "Catégories articles", "Unités"][index], result));

  const [accounts, journals, settings] = await Promise.all([
    svc.from("accounting_accounts").select("code").eq("organization_id", organizationId),
    svc.from("accounting_journals").select("code").eq("organization_id", organizationId),
    svc.from("accounting_settings").select("organization_id").eq("organization_id", organizationId).limit(1).maybeSingle(),
  ]);
  check("Lecture des comptes", accounts);
  check("Lecture des journaux", journals);
  check("Lecture des paramètres comptables", settings);

  // Do not treat a failed read as an empty table and insert duplicates.
  if (!accounts.error) {
    const known = new Set((accounts.data ?? []).map((account) => account.code as string));
    const missing = DEFAULT_CHART_OF_ACCOUNTS.filter((account) => !known.has(account.code));
    if (missing.length) {
      const result = await svc.from("accounting_accounts").insert(missing.map((account) => ({
        organization_id: organizationId, code: account.code, name: account.name,
        class_number: account.code.charAt(0), type: account.type, is_active: true,
        is_movement_allowed: true, is_auxiliary_required: false, is_auxiliary: false, is_system: true,
      })));
      check("Création des comptes", result);
    }
  }
  if (!journals.error) {
    const known = new Set((journals.data ?? []).map((journal) => journal.code as string));
    const missing = DEFAULT_ACCOUNTING_JOURNALS.filter((journal) => !known.has(journal.code));
    if (missing.length) {
      const result = await svc.from("accounting_journals").insert(missing.map((journal) => ({
        organization_id: organizationId, code: journal.code, name: journal.name,
        type: journal.type, description: journal.description, is_active: true,
      })));
      check("Création des journaux", result);
    }
  }
  if (!settings.error && !settings.data) {
    const result = await svc.from("accounting_settings").insert({
      organization_id: organizationId, sales_journal_code: "VE", purchases_journal_code: "AC",
      bank_journal_code: "BQ", cash_journal_code: "CA", od_journal_code: "OD",
    });
    check("Création des paramètres comptables", result);
  }

  if (errors.length) {
    throw new Error(`Configuration initiale incomplète : ${errors.join(" ; ")}`);
  }
}
