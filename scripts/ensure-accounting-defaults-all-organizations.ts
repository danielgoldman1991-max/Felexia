import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  } catch {
    // .env.local may not exist in CI.
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_ACCOUNTS = [
  ["1111", "Capital social", "equity"],
  ["1191", "Resultat net de l'exercice", "equity"],
  ["2111", "Frais preliminaires", "asset"],
  ["2332", "Materiel de transport", "asset"],
  ["2355", "Materiel informatique", "asset"],
  ["3111", "Marchandises", "asset"],
  ["3421", "Clients", "third_party"],
  ["3455", "Etat - TVA recuperable", "tax"],
  ["3488", "Divers debiteurs", "asset"],
  ["4411", "Fournisseurs", "third_party"],
  ["4455", "Etat - TVA facturee", "tax"],
  ["4488", "Divers crediteurs", "liability"],
  ["4501", "Etat - Impots et taxes", "liability"],
  ["5141", "Banques", "treasury"],
  ["5161", "Caisses", "treasury"],
  ["5520", "Credit de tresorerie", "liability"],
  ["6111", "Achats de marchandises", "expense"],
  ["6122", "Achats consommes / services", "expense"],
  ["6147", "Services bancaires", "expense"],
  ["6156", "Honoraires", "expense"],
  ["6161", "Impots et taxes", "expense"],
  ["6171", "Charges de personnel", "expense"],
  ["6311", "Interets des emprunts", "expense"],
  ["6588", "Autres charges diverses", "expense"],
  ["7111", "Ventes de marchandises", "revenue"],
  ["7121", "Ventes de biens et services produits", "revenue"],
  ["7124", "Prestations de services", "revenue"],
  ["7381", "Interets et produits assimiles", "revenue"],
  ["7588", "Autres produits divers", "revenue"],
] as const;

const DEFAULT_JOURNALS = [
  ["VE", "Journal des ventes", "sales", "Ecritures de ventes et facturation client"],
  ["AC", "Journal des achats", "purchases", "Ecritures d'achats et facturation fournisseur"],
  ["BQ", "Journal banque", "bank", "Operations bancaires"],
  ["CA", "Journal caisse", "cash", "Operations de caisse"],
  ["OD", "Operations diverses", "od", "Ecritures diverses et corrections"],
] as const;

async function ensureForOrganization(organization: { id: string; name: string }) {
  const [{ data: accounts }, { data: journals }, { data: settings }] = await Promise.all([
    supabase.from("accounting_accounts").select("code").eq("organization_id", organization.id),
    supabase.from("accounting_journals").select("code").eq("organization_id", organization.id),
    supabase.from("accounting_settings").select("organization_id").eq("organization_id", organization.id).limit(1).maybeSingle(),
  ]);

  const accountCodes = new Set((accounts ?? []).map((account) => account.code as string));
  const journalCodes = new Set((journals ?? []).map((journal) => journal.code as string));
  const missingAccounts = DEFAULT_ACCOUNTS.filter(([code]) => !accountCodes.has(code));
  const missingJournals = DEFAULT_JOURNALS.filter(([code]) => !journalCodes.has(code));

  if (missingAccounts.length > 0) {
    const { error } = await supabase.from("accounting_accounts").insert(
      missingAccounts.map(([code, name, type]) => ({
        organization_id: organization.id,
        code,
        name,
        class_number: code.charAt(0),
        type,
        is_active: true,
        is_movement_allowed: true,
        is_auxiliary_required: false,
        is_auxiliary: false,
        is_system: true,
      })),
    );
    if (error) throw error;
  }

  if (missingJournals.length > 0) {
    const { error } = await supabase.from("accounting_journals").insert(
      missingJournals.map(([code, name, type, description]) => ({
        organization_id: organization.id,
        code,
        name,
        type,
        description,
        is_active: true,
      })),
    );
    if (error) throw error;
  }

  if (!settings) {
    const { error } = await supabase.from("accounting_settings").insert({
      organization_id: organization.id,
      sales_journal_code: "VE",
      purchases_journal_code: "AC",
      bank_journal_code: "BQ",
      cash_journal_code: "CA",
      od_journal_code: "OD",
    });
    if (error) throw error;
  }

  console.log(
    `${organization.name}: ${missingAccounts.length} comptes crees, ${DEFAULT_ACCOUNTS.length - missingAccounts.length} comptes existants, ${missingJournals.length} journaux crees, ${DEFAULT_JOURNALS.length - missingJournals.length} journaux existants.`,
  );
}

async function main() {
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name");

  if (error) throw error;
  for (const organization of organizations ?? []) {
    await ensureForOrganization(organization as { id: string; name: string });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
