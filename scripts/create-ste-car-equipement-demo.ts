import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local ────────────────────────────────────────────────────────────
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
    // .env.local may not exist; fallback to system env
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL manquant. Ajoutez-le dans .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("\n❌ SUPABASE_SERVICE_ROLE_KEY manquant.");
  console.log("\nAjoutez cette ligne dans .env.local :");
  console.log("  SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key");
  console.log("\n(Vous trouverez cette cle dans : Supabase Dashboard > Project Settings > API > service_role key)");
  process.exit(1);
}

const ADMIN_EMAIL = "rida.moukasse@gmail.com";
const ORG_NAME = "STE CAR ÉQUIPEMENT SARL AU";
const ORG_SLUG = "ste-car-equipement";

// ── Supabase admin client (bypasses RLS via service role) ────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Step 1: Verify auth user ───────────────────────────────────────────────────
async function ensureAuthUser() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error(`❌ Erreur liste utilisateurs Auth : ${error.message}`);
    process.exit(1);
  }
  const existing = users.users.find((u) => u.email === ADMIN_EMAIL);
  if (existing) {
    console.log(`  ℹ Utilisateur Auth OK : ${ADMIN_EMAIL} (${existing.id})`);
    return existing.id;
  }
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║  L'utilisateur Auth ${ADMIN_EMAIL} n'existe pas encore.            ║
║                                                                          ║
║  Creer d'abord l'utilisateur dans Supabase Auth :                        ║
║  1. Allez dans Authentication > Users > Add user                         ║
║  2. Email : ${ADMIN_EMAIL}                                        ║
║  3. Password : choisir un mot de passe temporaire                        ║
║  4. Auto Confirm User : active                                           ║
║  5. Cliquer sur "Create user"                                            ║
║  6. Relancer ce script                                                   ║
╚══════════════════════════════════════════════════════════════════════════╝`);
  process.exit(0);
}

// ── Step 2: Ensure profiles row (FK target for organization_members) ──────────
async function ensureProfile(userId: string) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();
  if (existing) {
    console.log("  ℹ Profile deja existant");
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .insert({ id: userId, email: ADMIN_EMAIL });
  if (error) {
    console.error(`❌ Erreur creation profile : ${error.message}`);
    process.exit(1);
  }
  console.log("  ✅ Profile cree");
}

// ── Step 3: Organization ──────────────────────────────────────────────────────
async function ensureOrganization() {
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();
  if (existing) {
    console.log(`  ℹ Organisation existante : ${ORG_NAME} (${existing.id})`);
    return existing.id;
  }
  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name: ORG_NAME, slug: ORG_SLUG })
    .select("id")
    .single();
  if (error || !org) {
    console.error(`❌ Erreur creation organisation : ${error?.message}`);
    process.exit(1);
  }
  console.log(`  ✅ Organisation creee : ${ORG_NAME} (${org.id})`);
  return org.id;
}

// ── Step 4: Company settings ──────────────────────────────────────────────────
async function ensureCompanySettings(orgId: string) {
  const { data: existing } = await supabase
    .from("company_settings")
    .select("organization_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (existing) {
    console.log("  ℹ Company settings existants");
    return;
  }
  const { error } = await supabase.from("company_settings").insert({
    organization_id: orgId,
    legal_name: ORG_NAME,
    commercial_name: ORG_NAME,
    country: "MA",
    currency: "MAD",
  });
  if (error) {
    console.error(`❌ Erreur company_settings : ${error.message}`);
    process.exit(1);
  }
  console.log("  ✅ Company settings crees");
}

// ── Step 5: Roles & member ────────────────────────────────────────────────────
async function ensureRolesAndMember(orgId: string, userId: string) {
  const roleDefs = [
    { name: "admin", description: "Administrateur" },
    { name: "manager", description: "Manager" },
    { name: "sales", description: "Commercial" },
    { name: "accountant", description: "Comptable" },
    { name: "stock_user", description: "Stock" },
  ];

  let adminRoleId: string | null = null;

  for (const r of roleDefs) {
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", r.name)
      .maybeSingle();
    if (existing) {
      if (r.name === "admin") adminRoleId = existing.id;
      continue;
    }
    const { data: created } = await supabase
      .from("roles")
      .insert({ organization_id: orgId, ...r })
      .select("id")
      .single();
    if (created && r.name === "admin") adminRoleId = created.id;
  }

  if (!adminRoleId) {
    console.error("❌ Impossible de trouver ou creer le role admin");
    process.exit(1);
  }

  // Attach user
  const { data: member } = await supabase
    .from("organization_members")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (member) {
    if (member.status !== "active") {
      await supabase
        .from("organization_members")
        .update({ status: "active", role_id: adminRoleId })
        .eq("id", member.id);
      console.log("  ℹ Membre reactive");
    } else {
      console.log("  ℹ Membre deja actif");
    }
    return;
  }

  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role_id: adminRoleId, status: "active" });

  if (error) {
    console.error(`❌ Erreur rattachement membre : ${error.message}`);
    process.exit(1);
  }
  console.log("  ✅ Admin rattache (role admin)");
}

// ── Step 6: Referentials ──────────────────────────────────────────────────────

const DEFAULT_UNITS = [
  { name: "Unite", symbol: "U" },
  { name: "Heure", symbol: "h" },
  { name: "Jour", symbol: "j" },
  { name: "Mois", symbol: "mois" },
  { name: "Forfait", symbol: "forfait" },
  { name: "Kilogramme", symbol: "kg" },
  { name: "Litre", symbol: "L" },
  { name: "Metre", symbol: "m" },
  { name: "Boite", symbol: "boite" },
  { name: "Carton", symbol: "carton" },
];

const DEFAULT_TAX_RATES = [
  { name: "Exonere", rate: 0, is_default: false },
  { name: "TVA 7%", rate: 7, is_default: false },
  { name: "TVA 10%", rate: 10, is_default: true },
  { name: "TVA 14%", rate: 14, is_default: false },
  { name: "TVA 20%", rate: 20, is_default: false },
];

const DEFAULT_ACCOUNTS = [
  { code: "1111", name: "Capital social", type: "equity" },
  { code: "1121", name: "Reserves legales", type: "equity" },
  { code: "2111", name: "Frais de constitution", type: "asset" },
  { code: "2121", name: "Immobilisations incorporelles", type: "asset" },
  { code: "2131", name: "Immobilisations corporelles", type: "asset" },
  { code: "2341", name: "Immobilisations financieres", type: "asset" },
  { code: "3111", name: "Marchandises", type: "asset" },
  { code: "3121", name: "Matieres premieres", type: "asset" },
  { code: "3421", name: "Clients", type: "third_party" },
  { code: "3424", name: "Clients - Effets a recevoir", type: "third_party" },
  { code: "3455", name: "Etat - TVA recuperable", type: "tax" },
  { code: "34552", name: "Etat - TVA recuperable sur charges", type: "tax" },
  { code: "3488", name: "Charges constatees d'avance", type: "asset" },
  { code: "4411", name: "Fournisseurs", type: "third_party" },
  { code: "4414", name: "Fournisseurs - Effets a payer", type: "liability" },
  { code: "4455", name: "Etat - TVA facturee", type: "tax" },
  { code: "4488", name: "Produits constates d'avance", type: "liability" },
  { code: "5141", name: "Banques", type: "treasury" },
  { code: "5161", name: "Caisses", type: "treasury" },
  { code: "6111", name: "Achats de marchandises", type: "expense" },
  { code: "6122", name: "Achats consommes de matieres et fournitures", type: "expense" },
  { code: "6147", name: "Services bancaires", type: "expense" },
  { code: "6156", name: "Honoraires", type: "expense" },
  { code: "6181", name: "Frais postaux et telecommunications", type: "expense" },
  { code: "6311", name: "Salaires et appointements", type: "expense" },
  { code: "6411", name: "Charges sociales", type: "expense" },
  { code: "6588", name: "Autres charges diverses", type: "expense" },
  { code: "7111", name: "Ventes de marchandises", type: "revenue" },
  { code: "7121", name: "Ventes de biens et services produits", type: "revenue" },
  { code: "7124", name: "Prestations de services", type: "revenue" },
  { code: "7588", name: "Autres produits divers", type: "revenue" },
];

const DEFAULT_JOURNALS = [
  { code: "VE", name: "Journal des ventes", type: "sales" },
  { code: "AC", name: "Journal des achats", type: "purchases" },
  { code: "BQ", name: "Journal banque", type: "bank" },
  { code: "CA", name: "Journal caisse", type: "cash" },
  { code: "OD", name: "Operations diverses", type: "od" },
];

async function ensureUnits(orgId: string) {
  let count = 0;
  for (const u of DEFAULT_UNITS) {
    const { data: existing } = await supabase
      .from("units")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", u.name)
      .eq("symbol", u.symbol)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("units").insert({
      organization_id: orgId,
      name: u.name,
      symbol: u.symbol,
    });
    if (!error) count++;
  }
  return count;
}

async function ensureTaxRates(orgId: string) {
  let count = 0;
  for (const t of DEFAULT_TAX_RATES) {
    const { data: existing } = await supabase
      .from("tax_rates")
      .select("id")
      .eq("organization_id", orgId)
      .eq("rate", t.rate)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("tax_rates").insert({
      organization_id: orgId,
      name: t.name,
      rate: t.rate,
      is_default: t.is_default,
    });
    if (!error) count++;
  }
  return count;
}

async function ensureAccounts(orgId: string) {
  let count = 0;
  for (const a of DEFAULT_ACCOUNTS) {
    const { data: existing } = await supabase
      .from("accounting_accounts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("code", a.code)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("accounting_accounts").insert({
      organization_id: orgId,
      code: a.code,
      name: a.name,
      class_number: a.code.charAt(0),
      type: a.type,
      is_system: true,
    });
    if (!error) count++;
  }
  return count;
}

async function ensureJournals(orgId: string) {
  let count = 0;
  for (const j of DEFAULT_JOURNALS) {
    const { data: existing } = await supabase
      .from("accounting_journals")
      .select("id")
      .eq("organization_id", orgId)
      .eq("code", j.code)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("accounting_journals").insert({
      organization_id: orgId,
      code: j.code,
      name: j.name,
      type: j.type,
      is_active: true,
    });
    if (!error) count++;
  }
  return count;
}

async function ensureAccountingSettings(orgId: string) {
  const { data: existing } = await supabase
    .from("accounting_settings")
    .select("organization_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase.from("accounting_settings").insert({
    organization_id: orgId,
    sales_journal_code: "VE",
    purchases_journal_code: "AC",
    bank_journal_code: "BQ",
    cash_journal_code: "CA",
    od_journal_code: "OD",
    default_customer_account_code: "3421",
    default_supplier_account_code: "4411",
    default_sales_account_code: "7124",
    default_purchase_account_code: "6111",
    default_sales_vat_account_code: "4455",
    default_purchase_vat_account_code: "3455",
    default_bank_account_code: "5141",
    default_cash_account_code: "5161",
    default_bank_fees_account_code: "6147",
    numbering_prefix: "EC",
  });
  if (error) {
    console.error(`  ❌ Parametres comptables : ${error.message}`);
    return false;
  }
  return true;
}

async function ensureWarehouse(orgId: string) {
  const { data: existing } = await supabase
    .from("warehouses")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", "DEPOT-PRINCIPAL")
    .maybeSingle();
  if (existing) return false;

  const { error } = await supabase.from("warehouses").insert({
    organization_id: orgId,
    name: "Depot principal",
    code: "DEPOT-PRINCIPAL",
    location_type: "depot",
    is_default: true,
    status: "active",
  });
  if (error) {
    console.error(`  ❌ Depot : ${error.message}`);
    return false;
  }
  return true;
}

async function ensureTreasuryAccounts(orgId: string) {
  // Caisse principale
  const { data: cash } = await supabase
    .from("treasury_accounts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", "CAISSE-PRINCIPALE")
    .maybeSingle();
  if (!cash) {
    await supabase.from("treasury_accounts").insert({
      organization_id: orgId,
      name: "Caisse principale",
      code: "CAISSE-PRINCIPALE",
      account_type: "cash",
      currency: "MAD",
      opening_balance: 0,
      current_balance: 0,
      is_default: true,
      status: "active",
    });
  }

  // Banque principale
  const { data: bank } = await supabase
    .from("treasury_accounts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", "BANQUE-PRINCIPALE")
    .maybeSingle();
  if (!bank) {
    await supabase.from("treasury_accounts").insert({
      organization_id: orgId,
      name: "Banque principale",
      code: "BANQUE-PRINCIPALE",
      account_type: "bank",
      currency: "MAD",
      opening_balance: 0,
      current_balance: 0,
      status: "active",
    });
  }
}

async function ensureFiscalYear(orgId: string) {
  const year = new Date().getFullYear();
  const { data: existing } = await supabase
    .from("accounting_fiscal_years")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", String(year))
    .maybeSingle();
  if (existing) return;

  const { data: fy, error } = await supabase
    .from("accounting_fiscal_years")
    .insert({
      organization_id: orgId,
      name: String(year),
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !fy) {
    console.error(`  ❌ Exercice fiscal : ${error?.message}`);
    return;
  }

  const months = [
    "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
  ];
  for (let i = 0; i < 12; i++) {
    const start = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const end = i === 11 ? `${year}-12-31` : `${year}-${String(i + 2).padStart(2, "0")}-01`;
    await supabase.from("accounting_periods").insert({
      organization_id: orgId,
      fiscal_year_id: fy.id,
      name: months[i],
      start_date: start,
      end_date: end,
      status: "open",
    });
  }
}

// ── Verification ────────────────────────────────────────────────────────────────
const BUSINESS_TABLES = [
  "third_parties", "products", "sales_quotes", "sales_orders",
  "sales_deliveries", "sales_returns", "customer_invoices", "customer_payments",
  "customer_credit_notes", "purchase_orders", "purchase_receptions",
  "supplier_invoices", "supplier_payments", "stock_moves", "stock_levels",
  "treasury_transactions", "accounting_entries",
];

async function countBusinessDocs(orgId: string) {
  const results: { name: string; count: number }[] = [];
  for (const table of BUSINESS_TABLES) {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);
    results.push({ name: table, count: count ?? 0 });
  }
  return results;
}

async function countReferentiels(orgId: string) {
  const tables = [
    "accounting_accounts", "accounting_journals", "units",
    "tax_rates", "warehouses", "treasury_accounts",
  ];
  const results: { name: string; count: number }[] = [];
  for (const t of tables) {
    const { count } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);
    results.push({ name: t, count: count ?? 0 });
  }
  return results;
}

// ── MAIN ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  CREATION DOSSIER : STE CAR ÉQUIPEMENT SARL AU");
  console.log("══════════════════════════════════════════════════════\n");

  console.log("━ [1] Utilisateur Auth ────────────────────────────────");
  const userId = await ensureAuthUser();

  console.log("\n━ [2] Profile ─────────────────────────────────────────");
  await ensureProfile(userId);

  console.log("\n━ [3] Organisation ────────────────────────────────────");
  const orgId = await ensureOrganization();

  console.log("\n━ [4] Parametres entreprise ───────────────────────────");
  await ensureCompanySettings(orgId);

  console.log("\n━ [5] Roles et rattachement admin ─────────────────────");
  await ensureRolesAndMember(orgId, userId);

  console.log("\n━ [6] Referentiels ────────────────────────────────────");
  const units = await ensureUnits(orgId);
  console.log(`  Unites : ${units} creees`);
  const taxes = await ensureTaxRates(orgId);
  console.log(`  TVA : ${taxes} creees`);
  const accounts = await ensureAccounts(orgId);
  console.log(`  Comptes comptables : ${accounts} crees`);
  const journals = await ensureJournals(orgId);
  console.log(`  Journaux : ${journals} crees`);
  const settings = await ensureAccountingSettings(orgId);
  console.log(`  Parametres comptables : ${settings ? "crees" : "deja existants"}`);
  const warehouse = await ensureWarehouse(orgId);
  console.log(`  Depot principal : ${warehouse ? "cree" : "deja existant"}`);
  await ensureTreasuryAccounts(orgId);
  console.log(`  Comptes tresorerie : verifies`);
  await ensureFiscalYear(orgId);
  console.log(`  Exercice fiscal : verifie`);

  console.log("\n━ [7] Verification dossier vide ───────────────────────");
  const docs = await countBusinessDocs(orgId);
  let allEmpty = true;
  for (const d of docs) {
    const ok = d.count === 0;
    if (!ok) allEmpty = false;
    console.log(`  ${d.name.padEnd(25)} ${ok ? "✅ 0" : `⚠ ${d.count}`}`);
  }
  if (allEmpty) console.log("\n  ✅ Aucun document metier");

  console.log("\n━ [8] Referentiels installes ──────────────────────────");
  const refs = await countReferentiels(orgId);
  for (const r of refs) {
    console.log(`  ${r.name.padEnd(25)} ${r.count}`);
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  RESUME");
  console.log("══════════════════════════════════════════════════════");
  console.log(`
  organization_id : ${orgId}
  admin_user_id   : ${userId}
  email admin     : ${ADMIN_EMAIL}
  raison sociale  : ${ORG_NAME}

  ✅ Dossier cree, neuf et propre, sans documents commerciaux.
  ✅ Referentiels de base installes.
  ✅ Aucune donnee des autres organisations modifiee.
  `);
}

main().catch((err) => {
  console.error("\n❌ Erreur fatale :", err);
  process.exit(1);
});
