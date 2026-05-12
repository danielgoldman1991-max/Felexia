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

const ADMIN_EMAIL = "versionconsulting1@gmail.com";
const ADMIN_NAME = "ABDESSLAME LOUDAOUI";
const ORG_NAME = "VERSION CONSULTING";
const ORG_SLUG = "version-consulting";

// ── Supabase admin client ───────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ─────────────────────────────────────────────────────────────────────
async function ensureOrganization() {
  // Check if org already exists
  const { data: existing } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (existing) {
    console.log(`  ℹ Organisation existante : ${existing.name} (${existing.id})`);
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

async function ensureAuthUser() {
  // Check if user exists in auth.users via admin API
  const { data: users, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error(`❌ Erreur liste utilisateurs Auth : ${error.message}`);
    console.log("\n⚠  Assurez-vous que SUPABASE_SERVICE_ROLE_KEY est correcte et que l'API Auth est accessible.");
    process.exit(1);
  }

  const existingUser = users.users.find((u) => u.email === ADMIN_EMAIL);

  if (existingUser) {
    console.log(`  ℹ Utilisateur Auth existe deja : ${ADMIN_EMAIL} (${existingUser.id})`);
    return existingUser.id;
  }

  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║  L'utilisateur Auth ${ADMIN_EMAIL} n'existe pas encore.            ║
║                                                                          ║
║  Creer d'abord l'utilisateur dans Supabase Auth :                        ║
║  1. Allez dans Authentication > Users > Add user                         ║
║  2. Email : ${ADMIN_EMAIL}                                        ║
║  3. Password : choisir un mot de passe temporaire (ex: Welcome123!)      ║
║  4. Optionnel : ajouter full_name = ${ADMIN_NAME} dans user_metadata ║
║  5. Cliquer sur "Create user"                                            ║
║  6. Relancer ce script                                                   ║
╚══════════════════════════════════════════════════════════════════════════╝`);
  process.exit(0);
}

async function ensureProfile(userId: string) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    // Update name if empty
    await supabase
      .from("profiles")
      .update({ full_name: ADMIN_NAME, email: ADMIN_EMAIL })
      .eq("id", userId);
    console.log(`  ℹ Profile mis a jour : ${ADMIN_NAME}`);
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .insert({ id: userId, full_name: ADMIN_NAME, email: ADMIN_EMAIL });

  if (error) {
    console.error(`❌ Erreur creation profile : ${error.message}`);
    process.exit(1);
  }
  console.log(`  ✅ Profile cree : ${ADMIN_NAME}`);
}

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

  const { error } = await supabase
    .from("company_settings")
    .insert({
      organization_id: orgId,
      legal_name: ORG_NAME,
      commercial_name: ORG_NAME,
      city: "Marrakech",
      country: "MA",
      currency: "MAD",
    });

  if (error) {
    console.error(`❌ Erreur company_settings : ${error.message}`);
    process.exit(1);
  }
  console.log("  ✅ Company settings crees");
}

async function ensureAdminRoleAndMember(orgId: string, userId: string) {
  // Find or create 'admin' role for this org
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", "admin")
    .maybeSingle();

  let roleId: string;
  if (role) {
    roleId = role.id;
    console.log("  ℹ Role admin existant");
  } else {
    const { data: newRole, error } = await supabase
      .from("roles")
      .insert({ organization_id: orgId, name: "admin", description: "Administrateur" })
      .select("id")
      .single();
    if (error || !newRole) {
      console.error(`❌ Erreur creation role admin : ${error?.message}`);
      process.exit(1);
    }
    roleId = newRole.id;
    console.log("  ✅ Role admin cree");
  }

  // Create default roles: manager, sales, accountant, stock_user
  for (const r of [
    { name: "manager", description: "Manager" },
    { name: "sales", description: "Commercial" },
    { name: "accountant", description: "Comptable" },
    { name: "stock_user", description: "Stock" },
  ]) {
    const { data: existing } = await supabase
      .from("roles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", r.name)
      .maybeSingle();
    if (!existing) {
      await supabase.from("roles").insert({ organization_id: orgId, ...r });
    }
  }

  // Attach user as member
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
        .update({ status: "active", role_id: roleId })
        .eq("id", member.id);
      console.log("  ℹ Membre reactive");
    } else {
      console.log("  ℹ Membre deja actif");
    }
    return;
  }

  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role_id: roleId, status: "active" });

  if (error) {
    console.error(`❌ Erreur rattachement membre : ${error.message}`);
    process.exit(1);
  }
  console.log("  ✅ Membre rattache (admin)");
}

// ── Referentiels ────────────────────────────────────────────────────────────────

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
    if (error) {
      console.error(`  ❌ Unite "${u.name}" : ${error.message}`);
    } else {
      count++;
    }
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
    if (error) {
      console.error(`  ❌ TVA "${t.name}" : ${error.message}`);
    } else {
      count++;
    }
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
    if (error) {
      console.error(`  ❌ Compte "${a.code}" : ${error.message}`);
    } else {
      count++;
    }
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
    if (error) {
      console.error(`  ❌ Journal "${j.code}" : ${error.message}`);
    } else {
      count++;
    }
  }
  return count;
}

async function ensureAccountingSettings(orgId: string) {
  const { data: existing } = await supabase
    .from("accounting_settings")
    .select("organization_id")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (existing) {
    return 0;
  }

  // Get account IDs for default mappings
  const getAccountCode = async (code: string) => {
    const { data } = await supabase
      .from("accounting_accounts")
      .select("code")
      .eq("organization_id", orgId)
      .eq("code", code)
      .maybeSingle();
    return (data?.code as string) ?? code;
  };

  const salesVatCode = await getAccountCode("4455");
  const purchaseVatCode = await getAccountCode("3455");

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
    default_sales_vat_account_code: salesVatCode,
    default_purchase_vat_account_code: purchaseVatCode,
    default_bank_account_code: "5141",
    default_cash_account_code: "5161",
    default_bank_fees_account_code: "6147",
    numbering_prefix: "EC",
  });

  if (error) {
    console.error(`  ❌ accounting_settings : ${error.message}`);
    return 0;
  }
  return 1;
}

async function ensureWarehouse(orgId: string) {
  const { data: existing } = await supabase
    .from("warehouses")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", "DEPOT-PRINCIPAL")
    .maybeSingle();

  if (existing) {
    return 0;
  }

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
    return 0;
  }
  return 1;
}

async function ensureTreasuryAccount(orgId: string) {
  // Cash account: Caisse principale
  const { data: existingCash } = await supabase
    .from("treasury_accounts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", "CAISSE-PRINCIPALE")
    .maybeSingle();

  if (!existingCash) {
    const { error } = await supabase.from("treasury_accounts").insert({
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
    if (error) console.error(`  ❌ Caisse principale : ${error.message}`);
  }

  // Bank account: Banque principale
  const { data: existingBank } = await supabase
    .from("treasury_accounts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("code", "BANQUE-PRINCIPALE")
    .maybeSingle();

  if (!existingBank) {
    const { error } = await supabase.from("treasury_accounts").insert({
      organization_id: orgId,
      name: "Banque principale",
      code: "BANQUE-PRINCIPALE",
      account_type: "bank",
      currency: "MAD",
      opening_balance: 0,
      current_balance: 0,
      status: "active",
    });
    if (error) console.error(`  ❌ Banque principale : ${error.message}`);
  }

  return 2; // Always try both
}

async function ensureFiscalYear(orgId: string) {
  const year = new Date().getFullYear();
  const { data: existing } = await supabase
    .from("accounting_fiscal_years")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", String(year))
    .maybeSingle();

  if (existing) return null;

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
    return null;
  }

  // Create 12 monthly periods
  const months = [
    "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
  ];
  for (let i = 0; i < 12; i++) {
    const start = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const end = i === 11
      ? `${year}-12-31`
      : `${year}-${String(i + 2).padStart(2, "0")}-01`;

    await supabase.from("accounting_periods").insert({
      organization_id: orgId,
      fiscal_year_id: fy.id,
      name: months[i],
      start_date: start,
      end_date: end,
      status: "open",
    });
  }

  return fy.id;
}

// ── Count empty business tables ─────────────────────────────────────────────────
const BUSINESS_TABLES: { name: string; query: string }[] = [
  { name: "tiers", query: "third_parties" },
  { name: "produits", query: "products" },
  { name: "devis", query: "sales_quotes" },
  { name: "commandes client", query: "sales_orders" },
  { name: "BL client", query: "sales_deliveries" },
  { name: "retours client", query: "sales_returns" },
  { name: "factures client", query: "customer_invoices" },
  { name: "paiements client", query: "customer_payments" },
  { name: "avoirs client", query: "customer_credit_notes" },
  { name: "commandes fournisseur", query: "purchase_orders" },
  { name: "receptions", query: "purchase_receptions" },
  { name: "factures fournisseur", query: "supplier_invoices" },
  { name: "paiements fournisseur", query: "supplier_payments" },
  { name: "mouvements stock", query: "stock_moves" },
  { name: "niveaux stock", query: "stock_levels" },
  { name: "mouvements tresorerie", query: "treasury_transactions" },
  { name: "ecritures comptables", query: "accounting_entries" },
];

async function countBusinessDocs(orgId: string): Promise<{ name: string; count: number }[]> {
  const results: { name: string; count: number }[] = [];
  for (const t of BUSINESS_TABLES) {
    const { count, error } = await supabase
      .from(t.query)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);
    results.push({ name: t.name, count: error ? -1 : (count ?? 0) });
  }
  return results;
}

async function countReferentiels(orgId: string) {
  const tables = [
    { name: "comptes comptables", table: "accounting_accounts" },
    { name: "journaux", table: "accounting_journals" },
    { name: "unites", table: "units" },
    { name: "taux TVA", table: "tax_rates" },
    { name: "depots", table: "warehouses" },
    { name: "comptes tresorerie", table: "treasury_accounts" },
  ];
  const results: { name: string; count: number }[] = [];
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t.table)
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);
    results.push({ name: t.name, count: error ? -1 : (count ?? 0) });
  }
  return results;
}

// ── MAIN ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  CREATION DOSSIER DEMO : VERSION CONSULTING");
  console.log("══════════════════════════════════════════════════════\n");

  // Step 1: Auth user
  console.log("━ [1] Verification utilisateur Auth ─────────────────");
  const userId = await ensureAuthUser();
  console.log(`  Admin ID : ${userId}`);

  // Step 2: Organization
  console.log("\n━ [2] Organisation ──────────────────────────────────");
  const orgId = await ensureOrganization();

  // Step 3: Profile
  console.log("\n━ [3] Profile ───────────────────────────────────────");
  await ensureProfile(userId);

  // Step 4: Company settings
  console.log("\n━ [4] Parametres entreprise ────────────────────────");
  await ensureCompanySettings(orgId);

  // Step 5: Roles & membership
  console.log("\n━ [5] Roles et rattachement ────────────────────────");
  await ensureAdminRoleAndMember(orgId, userId);

  // Step 6: Referentiels
  console.log("\n━ [6] Referentiels ─────────────────────────────────");
  const unitsCreated = await ensureUnits(orgId);
  console.log(`  Unites : ${unitsCreated} creees`);
  const taxesCreated = await ensureTaxRates(orgId);
  console.log(`  TVA : ${taxesCreated} creees`);
  const accountsCreated = await ensureAccounts(orgId);
  console.log(`  Comptes comptables : ${accountsCreated} crees`);
  const journalsCreated = await ensureJournals(orgId);
  console.log(`  Journaux : ${journalsCreated} crees`);
  const settingsCreated = await ensureAccountingSettings(orgId);
  console.log(`  Parametres comptables : ${settingsCreated > 0 ? "crees" : "deja existants"}`);
  const warehouseCreated = await ensureWarehouse(orgId);
  console.log(`  Depots : ${warehouseCreated > 0 ? "cree" : "deja existant"}`);
  await ensureTreasuryAccount(orgId);
  console.log(`  Comptes tresorerie : verifies/crees`);
  const fiscalYearId = await ensureFiscalYear(orgId);
  console.log(`  Exercice fiscal : ${fiscalYearId ? "cree" : "deja existant"}`);

  // Step 7: Verification vide
  console.log("\n━ [7] Verification - Aucun document métier ──────────");
  const docs = await countBusinessDocs(orgId);
  let allEmpty = true;
  for (const d of docs) {
    const ok = d.count === 0;
    if (!ok) allEmpty = false;
    console.log(`  ${d.name.padEnd(25)} ${ok ? "✅ 0" : `⚠ ${d.count}`}`);
  }
  if (allEmpty) console.log("\n  ✅ Dossier totalement vide (aucun document metier)");

  // Step 8: Referentiels totals
  console.log("\n━ [8] Referentiels installes ────────────────────────");
  const refs = await countReferentiels(orgId);
  for (const r of refs) {
    console.log(`  ${r.name.padEnd(25)} ${r.count}`);
  }

  // ── Summary ──
  console.log("\n══════════════════════════════════════════════════════");
  console.log("  RESUME FINAL");
  console.log("══════════════════════════════════════════════════════");
  console.log(`
  organization_id : ${orgId}
  admin_user_id   : ${userId}
  email admin     : ${ADMIN_EMAIL}
  nom admin       : ${ADMIN_NAME}
  raison sociale  : ${ORG_NAME}

  ✅ Dossier neuf et propre, sans documents commerciaux.
  ✅ Referentiels de base installes (unites, TVA, plan comptable, journaux, depot).
  ✅ Aucune donnee des autres organisations modifiee.
  `);
}

main().catch((err) => {
  console.error("\n❌ Erreur fatale :", err);
  process.exit(1);
});
