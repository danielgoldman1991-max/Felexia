import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBusinessTrialEndDate } from "../src/lib/subscriptions/trial-config";

// ═══════════════════════════════════════════════════════════════════════════════
// 0. ENV + CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
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
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DEMO CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
type SeedScale = "small" | "medium" | "large";

const DEMO_CONFIG_RAW: Record<SeedScale, Record<string, number>> = {
  small: {
    clientsCount: 10, prospectsCount: 5, suppliersCount: 5, partnersCount: 3,
    productsCount: 10, servicesCount: 5,
    quotesCount: 15, salesOrdersCount: 10, deliveryNotesCount: 8,
    customerInvoicesCount: 12, customerCreditNotesCount: 3, customerPaymentsCount: 10,
    purchaseOrdersCount: 10, purchaseReceiptsCount: 8, supplierInvoicesCount: 10,
    supplierCreditNotesCount: 2, supplierPaymentsCount: 8,
    stockMovesCount: 50, treasuryTransactionsCount: 40,
    bankStatementsCount: 3, bankStatementLinesCount: 60,
    accountingEntriesCount: 50, accountingEntryLinesCount: 150,
    documentsCount: 30, vatMonthlyExportsCount: 3, vatQuarterlyExportsCount: 1,
  },
  medium: {
    clientsCount: 60, prospectsCount: 20, suppliersCount: 30, partnersCount: 10,
    productsCount: 80, servicesCount: 25,
    quotesCount: 150, salesOrdersCount: 90, deliveryNotesCount: 75,
    customerInvoicesCount: 85, customerCreditNotesCount: 15, customerPaymentsCount: 70,
    purchaseOrdersCount: 60, purchaseReceiptsCount: 55, supplierInvoicesCount: 65,
    supplierCreditNotesCount: 10, supplierPaymentsCount: 55,
    stockMovesCount: 300, treasuryTransactionsCount: 250,
    bankStatementsCount: 12, bankStatementLinesCount: 300,
    accountingEntriesCount: 500, accountingEntryLinesCount: 1500,
    documentsCount: 150, vatMonthlyExportsCount: 12, vatQuarterlyExportsCount: 4,
  },
  large: {
    clientsCount: 150, prospectsCount: 50, suppliersCount: 60, partnersCount: 40,
    productsCount: 200, servicesCount: 50,
    quotesCount: 300, salesOrdersCount: 180, deliveryNotesCount: 150,
    customerInvoicesCount: 170, customerCreditNotesCount: 30, customerPaymentsCount: 140,
    purchaseOrdersCount: 120, purchaseReceiptsCount: 110, supplierInvoicesCount: 130,
    supplierCreditNotesCount: 20, supplierPaymentsCount: 110,
    stockMovesCount: 600, treasuryTransactionsCount: 500,
    bankStatementsCount: 24, bankStatementLinesCount: 600,
    accountingEntriesCount: 1000, accountingEntryLinesCount: 3000,
    documentsCount: 300, vatMonthlyExportsCount: 24, vatQuarterlyExportsCount: 8,
  },
};

const SCALE: SeedScale = (process.env.DEMO_SEED_SCALE as SeedScale) ?? "medium";
const CFG = DEMO_CONFIG_RAW[SCALE] ?? DEMO_CONFIG_RAW.medium;

const DEMO_USER_EMAIL = "demo@felexia.pro";
const DEMO_USER_PASSWORD = "test@123";
const DEMO_USER_NAME = "Aziz Demo";
const ORG_NAME = "SOCIETE DEMO";
const ORG_SLUG = "societe-demo";

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DETERMINISTIC RANDOM GENERATORS (seeded for idempotency)
// ═══════════════════════════════════════════════════════════════════════════════
let _seed = 12345;
function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}

function randInt(min: number, max: number) {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

function randChoice<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function randBool(chance = 0.5) {
  return seededRandom() < chance;
}

function randDate(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  return new Date(start.getTime() + seededRandom() * diff);
}

function randPhone() {
  const prefixes = ["+212 522", "+212 537", "+212 539", "+212 528", "+212 535", "+212 524", "+212 661", "+212 662", "+212 666", "+212 670"];
  const p = randChoice(prefixes);
  return `${p} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════
const CITIES = ["Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir", "Fès", "Oujda", "Meknès", "Tétouan", "Kenitra", "Safi", "Mohammedia", "El Jadida", "Nador", "Khouribga", "Béni Mellal", "Settat", "Larache", "Ksar El Kebir", "Taza"];
const STREETS = ["Boulevard Mohammed V", "Avenue Hassan II", "Rue Ibn Sina", "Boulevard d'Anfa", "Avenue des FAR", "Rue de la Gare", "Boulevard Zerktouni", "Avenue Abdelkrim El Khattabi", "Rue Allal Ben Abdellah", "Boulevard Massira"];

const CLIENT_NAMES = [
  "Atlas Distribution", "Nova Services", "Riad Soleil", "Casa Office Pro", "Marrakech Digital Supply",
  "Tanger Logistique", "Rabat Conseil", "Agadir Equipement", "Fès Industrie", "Oujda Négoce",
  "Meknès Commerce", "Tétouan Import", "Kenitra Technologie", "Safi Emballage", "Mohammedia Transport",
  "El Jadida Boissons", "Nador Pêche", "Khouribga Matériaux", "Béni Mellal Agro", "Settat Textile",
  "Larache Bois", "Ksar El Kebir Métal", "Taza Construction", "Casablanca Food", "Rabat Pharma",
  "Marrakech Tourisme", "Tanger Automotive", "Agadir Energie", "Fès Céramique", "Oujda Plastique",
  "Meknès Électronique", "Tétouan Maritime", "Kenitra Alimentaire", "Safi Chimie", "Mohammedia Pétrole",
  "El Jadida Tourisme", "Nador Agriculture", "Khouribga Mine", "Béni Mellal Boisson", "Settat Métallurgie",
  "Larache Pêche", "Ksar El Kebir Textile", "Taza Transport", "Casablanca Immobilier", "Rabat Finance",
  "Marrakech Hôtel", "Tanger Port", "Agadir Fruits", "Fès Tannerie", "Oujda Bois",
  "Meknès Médical", "Tétouan Artisanat", "Kenitra Plastique", "Safi Verre", "Mohammedia Chocolat",
  "El Jadida Ciment", "Nador Énergie", "Khouribga Transport", "Béni Mellal Cuir", "Settat Pétrochimie",
];

const SUPPLIER_NAMES = [
  "Tech Supply Maroc", "Office Pro", "Translog Maroc", "Global Informatique", "Casa Papier",
  "Atlas Transport", "Maroc Maintenance", "Digital Parts", "Rabat Fournitures", "Marrakech Équipement",
  "Tanger Import", "Agadir Matériaux", "Fès Consommables", "Oujda Électronique", "Meknès Bois",
  "Tétouan Métal", "Kenitra Plastique", "Safi Chimie", "Mohammedia Pétrole", "El Jadida Alimentaire",
  "Nador Énergie", "Khouribga Mine", "Béni Mellal Textile", "Settat Métal", "Larache Pêche",
  "Ksar El Kebir Bois", "Taza Transport", "Casablanca Informatique", "Rabat Fournitures", "Marrakech Import",
];

const SECTORS = ["Informatique", "Bureau", "Transport", "Maintenance", "Import/Export", "Alimentaire", "Textile", "Construction", "Métallurgie", "Pharmacie", "Tourisme", "Agriculture"];

const PRODUCT_TEMPLATES = [
  { category: "Matériel informatique", prefix: "PC", name: "PC Portable", priceMin: 4000, priceMax: 12000 },
  { category: "Matériel informatique", prefix: "IMP", name: "Imprimante", priceMin: 800, priceMax: 3500 },
  { category: "Matériel informatique", prefix: "SCAN", name: "Scanner", priceMin: 600, priceMax: 2500 },
  { category: "Matériel informatique", prefix: "MON", name: "Écran", priceMin: 1000, priceMax: 5000 },
  { category: "Matériel informatique", prefix: "CLAV", name: "Clavier", priceMin: 80, priceMax: 500 },
  { category: "Matériel informatique", prefix: "SOUR", name: "Souris", priceMin: 50, priceMax: 300 },
  { category: "Matériel informatique", prefix: "DISQ", name: "Disque dur externe", priceMin: 400, priceMax: 2000 },
  { category: "Matériel informatique", prefix: "MEM", name: "Mémoire RAM", priceMin: 300, priceMax: 1500 },
  { category: "Matériel informatique", prefix: "CARTE", name: "Carte graphique", priceMin: 1500, priceMax: 8000 },
  { category: "Matériel informatique", prefix: "PROCES", name: "Processeur", priceMin: 1000, priceMax: 6000 },
  { category: "Matériel informatique", prefix: "WEBC", name: "Webcam", priceMin: 200, priceMax: 800 },
  { category: "Matériel informatique", prefix: "ROUTE", name: "Routeur WiFi", priceMin: 300, priceMax: 1500 },
  { category: "Matériel informatique", prefix: "SWITCH", name: "Switch réseau", priceMin: 500, priceMax: 3000 },
  { category: "Fournitures bureau", prefix: "PAPIER", name: "Ramette papier A4", priceMin: 25, priceMax: 60 },
  { category: "Fournitures bureau", prefix: "STYLO", name: "Stylo bille", priceMin: 2, priceMax: 15 },
  { category: "Fournitures bureau", prefix: "AGRAF", name: "Agrafeuse", priceMin: 30, priceMax: 120 },
  { category: "Fournitures bureau", prefix: "CLAS", name: "Classeur", priceMin: 15, priceMax: 50 },
  { category: "Fournitures bureau", prefix: "CAHI", name: "Cahier", priceMin: 8, priceMax: 30 },
  { category: "Fournitures bureau", prefix: "SURL", name: "Surligneur", priceMin: 5, priceMax: 20 },
  { category: "Fournitures bureau", prefix: "COLLE", name: "Colle", priceMin: 10, priceMax: 40 },
  { category: "Consommables", prefix: "TONER", name: "Toner", priceMin: 200, priceMax: 800 },
  { category: "Consommables", prefix: "CARTO", name: "Cartouche encre", priceMin: 150, priceMax: 600 },
  { category: "Consommables", prefix: "RUBAN", name: "Ruban adhésif", priceMin: 15, priceMax: 50 },
  { category: "Consommables", prefix: "POCH", name: "Pochette plastique", priceMin: 20, priceMax: 80 },
  { category: "Consommables", prefix: "BATT", name: "Batterie", priceMin: 300, priceMax: 1200 },
  { category: "Pièces détachées", prefix: "ECRAN", name: "Écran LCD", priceMin: 800, priceMax: 3500 },
  { category: "Pièces détachées", prefix: "CLAVP", name: "Clavier portable", priceMin: 200, priceMax: 800 },
  { category: "Pièces détachées", prefix: "BATTP", name: "Batterie portable", priceMin: 400, priceMax: 1500 },
  { category: "Pièces détachées", prefix: "CHARG", name: "Chargeur", priceMin: 150, priceMax: 600 },
  { category: "Pièces détachées", prefix: "VENTI", name: "Ventilateur", priceMin: 100, priceMax: 400 },
  { category: "Équipement", prefix: "BURE", name: "Bureau", priceMin: 800, priceMax: 3500 },
  { category: "Équipement", prefix: "CHAI", name: "Chaise bureau", priceMin: 400, priceMax: 2000 },
  { category: "Équipement", prefix: "ARMO", name: "Armoire", priceMin: 600, priceMax: 2500 },
  { category: "Équipement", prefix: "TABL", name: "Table réunion", priceMin: 1500, priceMax: 6000 },
  { category: "Équipement", prefix: "PROJ", name: "Projecteur", priceMin: 2000, priceMax: 8000 },
  { category: "Marchandises", prefix: "PACK", name: "Pack informatique", priceMin: 5000, priceMax: 15000 },
  { category: "Marchandises", prefix: "SUIT", name: "Suite logicielle", priceMin: 1000, priceMax: 5000 },
  { category: "Marchandises", prefix: "ANTI", name: "Antivirus", priceMin: 300, priceMax: 1200 },
  { category: "Marchandises", prefix: "SAUV", name: "Solution sauvegarde", priceMin: 800, priceMax: 3500 },
  { category: "Marchandises", prefix: "SECU", name: "Sécurité réseau", priceMin: 1500, priceMax: 6000 },
  { category: "Matériel réseau", prefix: "CABLE", name: "Câble réseau", priceMin: 50, priceMax: 200 },
  { category: "Matériel réseau", prefix: "RJ45", name: "Connecteur RJ45", priceMin: 5, priceMax: 30 },
  { category: "Matériel réseau", prefix: "WIFI", name: "Point d'accès WiFi", priceMin: 600, priceMax: 2500 },
  { category: "Matériel réseau", prefix: "FIBRE", name: "Câble fibre optique", priceMin: 200, priceMax: 800 },
  { category: "Matériel réseau", prefix: "RACK", name: "Rack serveur", priceMin: 2000, priceMax: 8000 },
  { category: "Emballages", prefix: "CARTO", name: "Carton", priceMin: 10, priceMax: 50 },
  { category: "Emballages", prefix: "BULLE", name: "Film bulle", priceMin: 30, priceMax: 120 },
  { category: "Emballages", prefix: "SCOTC", name: "Scotch", priceMin: 15, priceMax: 60 },
  { category: "Emballages", prefix: "SACH", name: "Sachet", priceMin: 5, priceMax: 25 },
  { category: "Emballages", prefix: "ETIQ", name: "Étiquette", priceMin: 20, priceMax: 80 },
];

const SERVICE_TEMPLATES = [
  { category: "Services", name: "Installation système", priceMin: 1000, priceMax: 5000 },
  { category: "Services", name: "Maintenance mensuelle", priceMin: 1500, priceMax: 6000 },
  { category: "Services", name: "Formation utilisateur", priceMin: 2000, priceMax: 8000 },
  { category: "Services", name: "Audit digital", priceMin: 5000, priceMax: 20000 },
  { category: "Services", name: "Support technique", priceMin: 800, priceMax: 3000 },
  { category: "Services", name: "Consultation IT", priceMin: 3000, priceMax: 12000 },
  { category: "Prestations", name: "Développement sur mesure", priceMin: 10000, priceMax: 50000 },
  { category: "Prestations", name: "Intégration logicielle", priceMin: 5000, priceMax: 25000 },
  { category: "Prestations", name: "Migration données", priceMin: 3000, priceMax: 15000 },
  { category: "Prestations", name: "Configuration réseau", priceMin: 2000, priceMax: 10000 },
  { category: "Transport", name: "Livraison express", priceMin: 150, priceMax: 800 },
  { category: "Transport", name: "Transport lourd", priceMin: 500, priceMax: 2500 },
  { category: "Location", name: "Location serveur", priceMin: 2000, priceMax: 8000 },
  { category: "Location", name: "Location matériel", priceMin: 500, priceMax: 3000 },
  { category: "Abonnement", name: "Abonnement cloud", priceMin: 500, priceMax: 2000 },
  { category: "Abonnement", name: "Licence annuelle", priceMin: 1000, priceMax: 5000 },
  { category: "Maintenance", name: "Maintenance préventive", priceMin: 2000, priceMax: 8000 },
  { category: "Maintenance", name: "Maintenance corrective", priceMin: 1000, priceMax: 5000 },
  { category: "Autre", name: "Frais divers", priceMin: 100, priceMax: 1000 },
  { category: "Autre", name: "Déplacement", priceMin: 200, priceMax: 1500 },
  { category: "Autre", name: "Hébergement web", priceMin: 300, priceMax: 1500 },
  { category: "Autre", name: "Nom de domaine", priceMin: 100, priceMax: 500 },
  { category: "Autre", name: "Certificat SSL", priceMin: 200, priceMax: 1000 },
  { category: "Autre", name: "Sauvegarde cloud", priceMin: 400, priceMax: 2000 },
  { category: "Autre", name: "Audit sécurité", priceMin: 8000, priceMax: 30000 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 4. STATE (shared across functions)
// ═══════════════════════════════════════════════════════════════════════════════
let DEMO_USER_ID = "";
let DEMO_ORG_ID = "";
let DEMO_ADMIN_ROLE_ID = "";

// ID map helpers for cross-referencing
const TAX_RATE_MAP: Record<number, string> = {}; // rate -> id
const UNIT_MAP: Record<string, string> = {}; // symbol -> id
const CATEGORY_MAP: Record<string, string> = {}; // name -> id
const PRODUCT_MAP: Record<string, string> = {}; // sku -> id
const WAREHOUSE_MAP: Record<string, string> = {}; // code -> id
const TREASURY_MAP: Record<string, string> = {}; // code -> id
const ACCOUNT_MAP: Record<string, string> = {}; // code -> id
const JOURNAL_MAP: Record<string, string> = {}; // code -> id
const THIRD_PARTY_MAP: Record<string, string> = {}; // name -> id
const ENTRY_COUNTER: Record<string, number> = {}; // journalCode -> counter

// ═══════════════════════════════════════════════════════════════════════════════
// 5. BATCH INSERT HELPER
// ═══════════════════════════════════════════════════════════════════════════════
async function batchInsert(table: string, rows: Record<string, unknown>[], chunkSize = 100) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`  ❌ batchInsert ${table} chunk ${i / chunkSize + 1}: ${error.message}`);
    }
  }
}

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. RESET DEMO ORG
// ═══════════════════════════════════════════════════════════════════════════════
async function resetDemoOrg() {
  if (process.env.RESET_DEMO_ORG !== "true") return;
  console.log("\n⚠️  RESET_DEMO_ORG=true — suppression des données démo...");

  const { data: org } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).maybeSingle();
  if (!org) {
    console.log("  ℹ Organisation démo inexistante, rien à supprimer.");
    return;
  }
  const orgId = org.id;

  const tables = [
    "tax_export_batches", "documents", "accounting_entry_lines", "accounting_entries",
    "treasury_transactions", "bank_reconciliations", "bank_statement_lines", "bank_statement_imports",
    "customer_payment_allocations", "customer_payments", "supplier_payment_allocations", "supplier_payments",
    "customer_credit_note_lines", "customer_credit_notes", "customer_invoice_lines", "customer_invoices",
    "supplier_invoice_lines", "supplier_invoices", "purchase_document_lines", "purchase_documents",
    "sales_document_lines", "sales_documents", "stock_moves", "stock_levels",
    "products", "third_parties", "treasury_accounts", "warehouses",
    "accounting_settings", "accounting_journals", "accounting_accounts", "accounting_periods", "accounting_fiscal_years",
    "company_settings", "organization_modules", "organization_subscriptions",
    "invitations", "organization_members", "roles",
    "tax_rates", "units", "product_categories", "customer_categories",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("organization_id", orgId);
    if (error) console.error(`  ⚠️ ${table}: ${error.message}`);
  }

  // Delete organization itself
  await supabase.from("organizations").delete().eq("id", orgId);

  // Optionally delete auth user
  if (process.env.FORCE_RESET_DEMO_USER === "true" && DEMO_USER_ID) {
    await supabase.auth.admin.deleteUser(DEMO_USER_ID);
    console.log("  ✅ Utilisateur auth supprimé");
  }

  console.log("  ✅ Données démo supprimées.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. ENSURE DEMO USER
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureDemoUser() {
  console.log("\n[1/15] User démo");

  // Try to find existing user
  const { data: users } = await supabase.auth.admin.listUsers();
  const existing = users?.users.find((u) => u.email === DEMO_USER_EMAIL);

  if (existing) {
    DEMO_USER_ID = existing.id;
    console.log(`  ℹ Utilisateur existant : ${DEMO_USER_EMAIL} (${DEMO_USER_ID})`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_USER_NAME },
    });
    if (error || !data.user) {
      console.error(`  ❌ Erreur création utilisateur : ${error?.message}`);
      process.exit(1);
    }
    DEMO_USER_ID = data.user.id;
    console.log(`  ✅ Utilisateur créé : ${DEMO_USER_EMAIL} (${DEMO_USER_ID})`);
  }

  // Ensure profile
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", DEMO_USER_ID).maybeSingle();
  if (!profile) {
    await supabase.from("profiles").insert({ id: DEMO_USER_ID, email: DEMO_USER_EMAIL, full_name: DEMO_USER_NAME });
    console.log("  ✅ Profile créé");
  } else {
    await supabase.from("profiles").update({ email: DEMO_USER_EMAIL, full_name: DEMO_USER_NAME }).eq("id", DEMO_USER_ID);
    console.log("  ℹ Profile mis à jour");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ENSURE ORGANIZATION
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureOrganization() {
  console.log("\n[2/15] Organisation");

  const { data: existing } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).maybeSingle();
  if (existing) {
    DEMO_ORG_ID = existing.id;
    console.log(`  ℹ Organisation existante : ${ORG_NAME} (${DEMO_ORG_ID})`);
    return;
  }

  const { data: org, error } = await supabase.from("organizations").insert({
    name: ORG_NAME,
    slug: ORG_SLUG,
    city: "Casablanca",
    // country: "Maroc",
    currency: "MAD",
    onboarding_step: "completed",
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
  }).select("id").single();

  if (error || !org) {
    console.error(`  ❌ Erreur création organisation : ${error?.message}`);
    process.exit(1);
  }
  DEMO_ORG_ID = org.id;
  console.log(`  ✅ Organisation créée : ${ORG_NAME} (${DEMO_ORG_ID})`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. COMPANY SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureCompanySettings() {
  const { data: existing } = await supabase.from("company_settings").select("organization_id").eq("organization_id", DEMO_ORG_ID).maybeSingle();
  if (existing) return;

  await supabase.from("company_settings").insert({
    organization_id: DEMO_ORG_ID,
    legal_name: "SOCIETE DEMO SARL AU",
    commercial_name: ORG_NAME,
    ice: "001122334455667",
    if_number: "12345678",
    rc: "54321",
    patente: "98765432",
    cnss: "1122334",
    address: "Angle Boulevard Mohammed V et Rue Ibn Sina, Casablanca",
    city: "Casablanca",
   // country: "Maroc",
    phone: "+212 522 10 20 30",
    email: "contact@societe-demo.ma",
    website: "https://demo.felexia.pro",
    currency: "MAD",
  });
  console.log("  ✅ Paramètres entreprise créés");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ROLES & MEMBERSHIP
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureRolesAndMembership() {
  console.log("\n  Rôles et rattachement");

  const roleDefs = [
    { name: "owner", description: "Propriétaire" },
    { name: "admin", description: "Administrateur" },
    { name: "manager", description: "Manager" },
    { name: "accountant", description: "Comptable" },
    { name: "sales", description: "Commercial" },
    { name: "viewer", description: "Lecteur" },
  ];

  for (const r of roleDefs) {
    const { data: existing } = await supabase.from("roles").select("id").eq("organization_id", DEMO_ORG_ID).eq("name", r.name).maybeSingle();
    if (existing) {
      if (r.name === "owner") DEMO_ADMIN_ROLE_ID = existing.id;
      continue;
    }
    const { data: created } = await supabase.from("roles").insert({ organization_id: DEMO_ORG_ID, ...r }).select("id").single();
    if (created && r.name === "owner") DEMO_ADMIN_ROLE_ID = created.id;
  }

  // Membership
  const { data: member } = await supabase.from("organization_members").select("id").eq("organization_id", DEMO_ORG_ID).eq("user_id", DEMO_USER_ID).maybeSingle();
  if (!member) {
    await supabase.from("organization_members").insert({
      organization_id: DEMO_ORG_ID, user_id: DEMO_USER_ID, role_id: DEMO_ADMIN_ROLE_ID, status: "active",
    });
    console.log("  ✅ Membre owner rattaché");
  } else {
    console.log("  ℹ Membre déjà rattaché");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 11. BUSINESS TRIAL & MODULES
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureBusinessTrialAndModules() {
  console.log("\n  Essai Business et modules");

  const { data: plan } = await supabase.from("subscription_plans").select("id").eq("code", "business").maybeSingle();

  const now = new Date();
  const trialEnd = getBusinessTrialEndDate(now);

  const { data: existingSub } = await supabase.from("organization_subscriptions").select("id").eq("organization_id", DEMO_ORG_ID).maybeSingle();

  const payload = {
    organization_id: DEMO_ORG_ID,
    plan_id: plan?.id ?? null,
    plan_code: "business",
    status: "trialing",
    billing_cycle: "monthly",
    billing_interval: "monthly",
    trial_started_at: now.toISOString(),
    trial_start: now.toISOString(),
    trial_end: trialEnd.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    trial_consent_accepted: true,
    trial_consent_accepted_at: now.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: trialEnd.toISOString(),
    cancel_at_period_end: false,
    monthly_amount: 690,
    yearly_amount: 6900,
    selected_modules: ["quotes", "invoicing", "documents", "crm", "purchases", "stock", "treasury", "accounting"],
    updated_at: now.toISOString(),
  };

  if (existingSub) {
    await supabase.from("organization_subscriptions").update(payload).eq("id", existingSub.id);
    console.log("  ℹ Abonnement mis à jour");
  } else {
    await supabase.from("organization_subscriptions").insert({ ...payload, created_at: now.toISOString() });
    console.log("  ✅ Essai Business créé");
  }

  // Modules
  const moduleKeys = ["quotes", "invoicing", "documents", "crm", "purchases", "stock", "treasury", "accounting"];
  const moduleRows = moduleKeys.map((mk) => ({
    organization_id: DEMO_ORG_ID,
    module_key: mk,
    enabled: true,
    created_at: now.toISOString(),
  }));

  await supabase.from("organization_modules").upsert(moduleRows, { onConflict: "organization_id,module_key" });
  console.log("  ✅ Modules Business activés");
}

// ═══════════════════════════════════════════════════════════════════════════════
// 12. REFERENCE DATA
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureReferenceData() {
  console.log("\n[3/15] Référentiels");

  // Tax rates
  const taxRates = [
    { name: "TVA 0%", rate: 0, is_default: false },
    { name: "TVA 10%", rate: 10, is_default: false },
    { name: "TVA 14%", rate: 14, is_default: false },
    { name: "TVA 20%", rate: 20, is_default: true },
  ];
  for (const t of taxRates) {
    const { data: existing } = await supabase.from("tax_rates").select("id, rate").eq("organization_id", DEMO_ORG_ID).eq("rate", t.rate).maybeSingle();
    if (existing) {
      TAX_RATE_MAP[t.rate] = existing.id;
      continue;
    }
    const { data: created } = await supabase.from("tax_rates").insert({
      organization_id: DEMO_ORG_ID, name: t.name, rate: t.rate, is_default: t.is_default, is_active: true,
    }).select("id").single();
    if (created) TAX_RATE_MAP[t.rate] = created.id;
  }
  console.log(`  ✅ TVA : ${Object.keys(TAX_RATE_MAP).length} taux`);

  // Units
  const units = [
    { name: "Unité", symbol: "U" }, { name: "Pièce", symbol: "pièce" }, { name: "Kilogramme", symbol: "kg" },
    { name: "Litre", symbol: "L" }, { name: "Mètre", symbol: "m" }, { name: "Boîte", symbol: "boîte" },
    { name: "Carton", symbol: "carton" }, { name: "Heure", symbol: "h" }, { name: "Jour", symbol: "j" },
    { name: "Forfait", symbol: "forfait" }, { name: "Mois", symbol: "mois" },
  ];
  const unitRows = units.map((u) => ({ organization_id: DEMO_ORG_ID, name: u.name, symbol: u.symbol, is_active: true }));
  await supabase.from("units").upsert(unitRows, { onConflict: "organization_id,symbol" });
  const { data: unitData } = await supabase.from("units").select("id, symbol").eq("organization_id", DEMO_ORG_ID);
  for (const u of unitData ?? []) UNIT_MAP[u.symbol] = u.id;
  console.log(`  ✅ Unités : ${Object.keys(UNIT_MAP).length}`);

  // Product categories
  const productCategories = [
    { name: "Marchandises", type: "product" }, { name: "Produits finis", type: "product" },
    { name: "Matières premières", type: "product" }, { name: "Consommables", type: "product" },
    { name: "Pièces détachées", type: "product" }, { name: "Fournitures bureau", type: "product" },
    { name: "Matériel informatique", type: "product" }, { name: "Équipement", type: "product" },
    { name: "Services", type: "service" }, { name: "Prestations", type: "service" },
    { name: "Maintenance", type: "service" }, { name: "Transport", type: "service" },
    { name: "Location", type: "service" }, { name: "Abonnement", type: "service" },
    { name: "Autre", type: "mixed" }, { name: "Matériel réseau", type: "product" },
    { name: "Emballages", type: "product" },
  ];
  const catRows = productCategories.map((c) => ({ organization_id: DEMO_ORG_ID, name: c.name, type: c.type, status: "active", is_active: true }));
  await supabase.from("product_categories").upsert(catRows, { onConflict: "organization_id,name" });
  const { data: catData } = await supabase.from("product_categories").select("id, name").eq("organization_id", DEMO_ORG_ID);
  for (const c of catData ?? []) CATEGORY_MAP[c.name] = c.id;
  console.log(`  ✅ Catégories articles : ${Object.keys(CATEGORY_MAP).length}`);

  // Customer categories
  const customerCategories = [
    { name: "Prospect", is_default: false }, { name: "Client particulier", is_default: false },
    { name: "Client professionnel", is_default: true }, { name: "Client revendeur", is_default: false },
    { name: "Client grand compte", is_default: false }, { name: "Client administration", is_default: false },
    { name: "Client association", is_default: false }, { name: "Autre", is_default: false },
  ];
  const ccRows = customerCategories.map((c) => ({ organization_id: DEMO_ORG_ID, name: c.name, is_default: c.is_default }));
  await supabase.from("customer_categories").upsert(ccRows, { onConflict: "organization_id,name" });
  console.log(`  ✅ Catégories clients : ${customerCategories.length}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 13. WAREHOUSES
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureWarehouses() {
  const warehouses = [
    { code: "ENT-CASA", name: "Entrepôt Central Casablanca", location_type: "warehouse", is_default: true },
    { code: "DEP-MAR", name: "Dépôt Marrakech", location_type: "depot", is_default: false },
    { code: "MAG-SHOW", name: "Magasin Showroom", location_type: "store", is_default: false },
    { code: "ZONE-RET", name: "Zone Retours Clients", location_type: "zone", is_default: false },
    { code: "ZONE-REC", name: "Zone Réception Fournisseurs", location_type: "zone", is_default: false },
  ];

  for (const w of warehouses) {
    const { data: existing } = await supabase.from("warehouses").select("id").eq("organization_id", DEMO_ORG_ID).eq("code", w.code).maybeSingle();
    if (existing) {
      WAREHOUSE_MAP[w.code] = existing.id;
      continue;
    }
    const { data: created } = await supabase.from("warehouses").insert({
      organization_id: DEMO_ORG_ID, ...w, status: "active",
    }).select("id").single();
    if (created) WAREHOUSE_MAP[w.code] = created.id;
  }
  console.log(`  ✅ Entrepôts : ${Object.keys(WAREHOUSE_MAP).length}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 14. TREASURY ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureTreasuryAccounts() {
  const accounts = [
    {
      code: "BANK-AWB", name: "Banque Attijariwafa Bank", account_type: "bank", bank_name: "Attijariwafa Bank",
      rib: "007 810 0001234567890123 45", opening_balance: 150000, current_balance: 150000, is_default: true,
    },
    {
      code: "BANK-BP", name: "Banque Populaire", account_type: "bank", bank_name: "Banque Populaire",
      rib: "011 780 0009876543210123 67", opening_balance: 60000, current_balance: 60000, is_default: false,
    },
    {
      code: "CASH-SIEGE", name: "Caisse siège", account_type: "cash", opening_balance: 10000, current_balance: 10000, is_default: true,
    },
    {
      code: "CASH-SHOW", name: "Caisse showroom", account_type: "cash", opening_balance: 5000, current_balance: 5000, is_default: false,
    },
  ];

  for (const a of accounts) {
    const { data: existing } = await supabase.from("treasury_accounts").select("id").eq("organization_id", DEMO_ORG_ID).eq("code", a.code).maybeSingle();
    if (existing) {
      TREASURY_MAP[a.code] = existing.id;
      continue;
    }
    const { data: created } = await supabase.from("treasury_accounts").insert({
      organization_id: DEMO_ORG_ID, currency: "MAD", status: "active", ...a,
    }).select("id").single();
    if (created) TREASURY_MAP[a.code] = created.id;
  }
  console.log(`  ✅ Comptes trésorerie : ${Object.keys(TREASURY_MAP).length}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 15. CHART OF ACCOUNTS & JOURNALS
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureAccountingBase() {
  const accounts = [
    { code: "1111", name: "Capital social", type: "equity" },
    { code: "1191", name: "Résultat net de l'exercice", type: "equity" },
    { code: "2111", name: "Frais préliminaires", type: "asset" },
    { code: "2332", name: "Matériel de transport", type: "asset" },
    { code: "2355", name: "Matériel informatique", type: "asset" },
    { code: "3111", name: "Marchandises", type: "asset" },
    { code: "3421", name: "Clients", type: "third_party" },
    { code: "3455", name: "État - TVA récupérable", type: "tax" },
    { code: "3488", name: "Divers débiteurs", type: "asset" },
    { code: "4411", name: "Fournisseurs", type: "third_party" },
    { code: "4455", name: "État - TVA facturée", type: "tax" },
    { code: "4488", name: "Divers créanciers", type: "liability" },
    { code: "4501", name: "État - Impôts et taxes", type: "liability" },
    { code: "5141", name: "Banques", type: "treasury" },
    { code: "5161", name: "Caisses", type: "treasury" },
    { code: "5520", name: "Crédit de trésorerie", type: "liability" },
    { code: "6111", name: "Achats de marchandises", type: "expense" },
    { code: "6122", name: "Achats consommés / services", type: "expense" },
    { code: "6147", name: "Services bancaires", type: "expense" },
    { code: "6156", name: "Honoraires", type: "expense" },
    { code: "6161", name: "Impôts et taxes", type: "expense" },
    { code: "6171", name: "Charges de personnel", type: "expense" },
    { code: "6311", name: "Intérêts des emprunts", type: "expense" },
    { code: "6588", name: "Autres charges diverses", type: "expense" },
    { code: "7111", name: "Ventes de marchandises", type: "revenue" },
    { code: "7121", name: "Ventes de biens et services produits", type: "revenue" },
    { code: "7124", name: "Prestations de services", type: "revenue" },
    { code: "7381", name: "Intérêts et produits assimilés", type: "revenue" },
    { code: "7588", name: "Autres produits divers", type: "revenue" },
  ];

  for (const a of accounts) {
    const { data: existing } = await supabase.from("accounting_accounts").select("id").eq("organization_id", DEMO_ORG_ID).eq("code", a.code).maybeSingle();
    if (existing) {
      ACCOUNT_MAP[a.code] = existing.id;
      continue;
    }
    const { data: created } = await supabase.from("accounting_accounts").insert({
      organization_id: DEMO_ORG_ID, ...a, class_number: a.code.charAt(0), is_active: true, is_movement_allowed: true, is_auxiliary_required: false, is_auxiliary: false, is_system: true,
    }).select("id").single();
    if (created) ACCOUNT_MAP[a.code] = created.id;
  }
  console.log(`  ✅ Plan comptable : ${Object.keys(ACCOUNT_MAP).length} comptes`);

  // Journals
  const journals = [
    { code: "VE", name: "Journal des ventes", type: "sales" },
    { code: "AC", name: "Journal des achats", type: "purchases" },
    { code: "BQ", name: "Journal banque", type: "bank" },
    { code: "CA", name: "Journal caisse", type: "cash" },
    { code: "OD", name: "Opérations diverses", type: "od" },
  ];

  for (const j of journals) {
    const { data: existing } = await supabase.from("accounting_journals").select("id").eq("organization_id", DEMO_ORG_ID).eq("code", j.code).maybeSingle();
    if (existing) {
      JOURNAL_MAP[j.code] = existing.id;
      continue;
    }
    const { data: created } = await supabase.from("accounting_journals").insert({
      organization_id: DEMO_ORG_ID, ...j, is_active: true,
    }).select("id").single();
    if (created) JOURNAL_MAP[j.code] = created.id;
  }
  console.log(`  ✅ Journaux : ${Object.keys(JOURNAL_MAP).length}`);

  // Accounting settings
  const { data: existingSettings } = await supabase.from("accounting_settings").select("organization_id").eq("organization_id", DEMO_ORG_ID).maybeSingle();
  if (!existingSettings) {
    await supabase.from("accounting_settings").insert({
      organization_id: DEMO_ORG_ID,
      sales_journal_code: "VE", purchases_journal_code: "AC", bank_journal_code: "BQ",
      cash_journal_code: "CA", od_journal_code: "OD",
      default_customer_account_code: "3421", default_supplier_account_code: "4411",
      default_sales_account_code: "7124", default_purchase_account_code: "6111",
      default_sales_vat_account_code: "4455", default_purchase_vat_account_code: "3455",
      default_bank_account_code: "5141", default_cash_account_code: "5161",
      default_bank_fees_account_code: "6147", numbering_prefix: "EC",
    });
    console.log("  ✅ Paramètres comptables créés");
  }

  // Fiscal year
  const year = 2026;
  const { data: existingFy } = await supabase.from("accounting_fiscal_years").select("id").eq("organization_id", DEMO_ORG_ID).eq("name", String(year)).maybeSingle();
  if (!existingFy) {
    const { data: fy } = await supabase.from("accounting_fiscal_years").insert({
      organization_id: DEMO_ORG_ID, name: String(year), start_date: `${year}-01-01`, end_date: `${year}-12-31`, status: "open",
    }).select("id").single();
    if (fy) {
      const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      for (let i = 0; i < 12; i++) {
        const start = `${year}-${String(i + 1).padStart(2, "0")}-01`;
        const end = i === 11 ? `${year}-12-31` : `${year}-${String(i + 2).padStart(2, "0")}-01`;
        await supabase.from("accounting_periods").insert({
          organization_id: DEMO_ORG_ID, fiscal_year_id: fy.id, name: months[i], start_date: start, end_date: end, status: "open",
        });
      }
    }
    console.log("  ✅ Exercice fiscal 2026 créé");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 16. THIRD PARTIES (MASSIVE)
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureThirdParties() {
  console.log("\n[4/15] Tiers");

  const startDate = new Date("2026-01-01");
  const endDate = new Date("2026-12-31");

  // Clients
  const clients: Record<string, unknown>[] = [];
  for (let i = 0; i < CFG.clientsCount; i++) {
    const nameBase = CLIENT_NAMES[i % CLIENT_NAMES.length];
    const name = i < CLIENT_NAMES.length ? `${nameBase} SARL` : `${nameBase} ${String.fromCharCode(65 + (i % 26))} SARL`;
    const hasIce = i < CFG.clientsCount - 5; // Last 5 without ICE
    const city = randChoice(CITIES);
    const createdAt = randDate(startDate, endDate);
    clients.push({
      organization_id: DEMO_ORG_ID,
      name,
      types: ["customer"],
      primary_type: "customer",
      type: "customer" as const,
      ice: hasIce ? String(100000000000000 + i * 10000000000001).slice(0, 15) : null,
      if_number: hasIce ? String(12345678 + i) : null,
      rc: String(50000 + i),
      email: `contact.${i}@demo-client.ma`,
      phone: randPhone(),
      address: `${randInt(1, 200)} ${randChoice(STREETS)}, ${city}`,
      city,
     // country: "Maroc",
      status: "active",
      payment_terms_days: randInt(15, 60),
      credit_limit: randInt(10000, 200000),
      vat_subject: true,
      created_at: createdAt.toISOString(),
    });
  }
  await batchInsert("third_parties", clients);

  // Prospects
  const prospects: Record<string, unknown>[] = [];
  for (let i = 0; i < CFG.prospectsCount; i++) {
    const name = `Prospect ${randChoice(SECTORS)} ${String.fromCharCode(65 + i)}`;
    const city = randChoice(CITIES);
    prospects.push({
      organization_id: DEMO_ORG_ID,
      name,
      types: ["prospect"],
      primary_type: "prospect",
      type: null,
      email: `prospect.${i}@demo-prospect.ma`,
      phone: randPhone(),
      address: `${randInt(1, 200)} ${randChoice(STREETS)}, ${city}`,
      city,
      //country: "Maroc",
      status: "active",
      prospect_status: randChoice(["new", "qualified", "contacted", "lost", "converted"]),
      potential_value: randInt(5000, 100000),
      created_at: randDate(startDate, endDate).toISOString(),
    });
  }
  await batchInsert("third_parties", prospects);

  // Suppliers
  const suppliers: Record<string, unknown>[] = [];
  for (let i = 0; i < CFG.suppliersCount; i++) {
    const nameBase = SUPPLIER_NAMES[i % SUPPLIER_NAMES.length];
    const name = i < SUPPLIER_NAMES.length ? `${nameBase} SARL` : `${nameBase} ${String.fromCharCode(65 + (i % 26))} SARL`;
    const hasIce = i < CFG.suppliersCount - 3; // Last 3 without ICE
    const city = randChoice(CITIES);
    suppliers.push({
      organization_id: DEMO_ORG_ID,
      name,
      types: ["supplier"],
      primary_type: "supplier",
      type: "supplier" as const,
      ice: hasIce ? String(200000000000000 + i * 10000000000001).slice(0, 15) : null,
      if_number: hasIce ? String(22345678 + i) : String(99001122 + i),
      rc: String(60000 + i),
      email: `facturation.${i}@demo-fournisseur.ma`,
      phone: randPhone(),
      address: `${randInt(1, 200)} ${randChoice(STREETS)}, ${city}`,
      city,
      country: "Maroc",
      status: "active",
      payment_terms_days: randInt(15, 90),
      supplier_rating: randInt(1, 5),
      created_at: randDate(startDate, endDate).toISOString(),
    });
  }
  await batchInsert("third_parties", suppliers);

  // Partners / divers
  const partners: Record<string, unknown>[] = [];
  const partnerTypes = ["expert-comptable", "transporteur", "banque", "assurance", "consultant", "sous-traitant", "avocat", "notaire", "architecte", "designer"];
  for (let i = 0; i < CFG.partnersCount; i++) {
    const city = randChoice(CITIES);
    partners.push({
      organization_id: DEMO_ORG_ID,
      name: `Partenaire ${partnerTypes[i % partnerTypes.length]} ${String.fromCharCode(65 + i)}`,
      types: ["customer"],
      primary_type: "customer",
      type: "customer" as const,
      email: `partenaire.${i}@demo-partenaire.ma`,
      phone: randPhone(),
      address: `${randInt(1, 200)} ${randChoice(STREETS)}, ${city}`,
      city,
      //country: "Maroc",
      status: "active",
      created_at: randDate(startDate, endDate).toISOString(),
    });
  }
  await batchInsert("third_parties", partners);

  // Load IDs into map
  const { data: allTiers } = await supabase.from("third_parties").select("id, name").eq("organization_id", DEMO_ORG_ID);
  for (const t of allTiers ?? []) THIRD_PARTY_MAP[t.name] = t.id;

  const totalTiers = (allTiers ?? []).length;
  console.log(`  ✅ ${totalTiers} tiers créés (${CFG.clientsCount} clients, ${CFG.prospectsCount} prospects, ${CFG.suppliersCount} fournisseurs, ${CFG.partnersCount} partenaires)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 17. PRODUCTS & SERVICES (MASSIVE)
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureProducts() {
  console.log("\n[5/15] Articles et services");

  const products: Record<string, unknown>[] = [];

  // Products
  for (let i = 0; i < CFG.productsCount; i++) {
    const tmpl = PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length];
    const sku = `DEMO-${tmpl.prefix}-${String(i + 1).padStart(3, "0")}`;
    const variant = randInt(1, 5);
    const name = `${tmpl.name} ${variant}`;
    const purchasePrice = randInt(tmpl.priceMin, Math.floor(tmpl.priceMax * 0.6));
    const salePrice = randInt(Math.floor(tmpl.priceMax * 0.7), tmpl.priceMax);
    const taxRate = randChoice([0, 10, 14, 20, 20, 20, 20]); // 20% majority
    const stockInitial = randInt(0, 100);
    const catId = CATEGORY_MAP[tmpl.category] ?? CATEGORY_MAP["Autre"];
    const unitId = UNIT_MAP["U"] ?? null;
    const taxRateId = TAX_RATE_MAP[taxRate] ?? TAX_RATE_MAP[20];

    products.push({
      organization_id: DEMO_ORG_ID,
      type: "product",
      sku,
      name,
      description: `${name} - ${tmpl.category}`,
      category_id: catId,
      unit_id: unitId,
      purchase_price: purchasePrice,
      sale_price: salePrice,
      purchase_price_ht: purchasePrice,
      sale_price_ht: salePrice,
      sale_price_ttc: Math.round(salePrice * (1 + taxRate / 100) * 100) / 100,
      tax_rate_id: taxRateId,
      track_stock: true,
      min_stock: randInt(0, 20),
      current_stock: stockInitial,
      status: i === CFG.productsCount - 1 ? "inactive" : "active",
      is_sellable: true,
      is_purchasable: true,
      created_at: new Date().toISOString(),
    });
  }

  // Services
  for (let i = 0; i < CFG.servicesCount; i++) {
    const tmpl = SERVICE_TEMPLATES[i % SERVICE_TEMPLATES.length];
    const sku = `DEMO-SRV-${String(i + 1).padStart(3, "0")}`;
    const variant = randInt(1, 3);
    const name = `${tmpl.name} ${variant}`;
    const salePrice = randInt(tmpl.priceMin, tmpl.priceMax);
    const taxRate = randChoice([0, 10, 14, 20, 20, 20, 20]);
    const catId = CATEGORY_MAP[tmpl.category] ?? CATEGORY_MAP["Autre"];
    const unitId = UNIT_MAP["h"] ?? UNIT_MAP["U"] ?? null;
    const taxRateId = TAX_RATE_MAP[taxRate] ?? TAX_RATE_MAP[20];

    products.push({
      organization_id: DEMO_ORG_ID,
      type: "service",
      sku,
      name,
      description: `${name} - ${tmpl.category}`,
      category_id: catId,
      unit_id: unitId,
      purchase_price: 0,
      sale_price: salePrice,
      purchase_price_ht: 0,
      sale_price_ht: salePrice,
      sale_price_ttc: Math.round(salePrice * (1 + taxRate / 100) * 100) / 100,
      tax_rate_id: taxRateId,
      track_stock: false,
      min_stock: 0,
      current_stock: 0,
      status: "active",
      is_sellable: true,
      is_purchasable: false,
      created_at: new Date().toISOString(),
    });
  }

  await batchInsert("products", products);

  // Load IDs
  const { data: allProducts } = await supabase.from("products").select("id, sku").eq("organization_id", DEMO_ORG_ID);
  for (const p of allProducts ?? []) PRODUCT_MAP[p.sku] = p.id;

  console.log(`  ✅ ${(allProducts ?? []).length} articles/services créés (${CFG.productsCount} produits, ${CFG.servicesCount} services)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 18. STOCK LEVELS & MOVES
// ═══════════════════════════════════════════════════════════════════════════════
async function ensureStock() {
  console.log("\n[6/15] Stock");

  const warehouseId = WAREHOUSE_MAP["ENT-CASA"];

  if (!warehouseId) {
    console.log("  ⚠️ Pas d'entrepôt principal, stock ignoré");
    return;
  }

  // Stock levels for products with track_stock
  const { data: trackableProducts } = await supabase.from("products").select("id, current_stock").eq("organization_id", DEMO_ORG_ID).eq("track_stock", true).eq("type", "product");

  const stockLevels: Record<string, unknown>[] = [];
  for (const p of trackableProducts ?? []) {
    stockLevels.push({
      organization_id: DEMO_ORG_ID,
      warehouse_id: warehouseId,
      product_id: p.id,
      quantity: p.current_stock ?? randInt(0, 100),
    });
  }
  if (stockLevels.length > 0) {
    await batchInsert("stock_levels", stockLevels);
  }
  console.log(`  ✅ ${stockLevels.length} niveaux de stock créés`);

  // Stock moves
  const moveTypes = ["initial_stock", "purchase_receipt_in", "delivery_out", "customer_return_in", "adjustment_in", "adjustment_out", "manual_stock_in", "manual_stock_out"];
  const moves: Record<string, unknown>[] = [];

  for (let i = 0; i < CFG.stockMovesCount; i++) {
    const moveType = randChoice(moveTypes);
    const direction = moveType === "delivery_out" || moveType === "adjustment_out" || moveType === "manual_stock_out" ? "out" : "in";
    const pId = randChoice(Object.values(PRODUCT_MAP));
    const whId = randChoice(Object.values(WAREHOUSE_MAP));
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);

    moves.push({
      organization_id: DEMO_ORG_ID,
      product_id: pId,
      warehouse_id: whId,
      move_type: moveType,
      direction,
      quantity: randInt(1, 50),
      movement_date: date.toISOString(),
      notes: `Mouvement ${i + 1}`,
      created_at: date.toISOString(),
    });
  }

  await batchInsert("stock_moves", moves);
  console.log(`  ✅ ${moves.length} mouvements de stock créés`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 19. SALES DOCUMENTS (MASSIVE)
// ═══════════════════════════════════════════════════════════════════════════════
async function seedSalesDocuments() {
  console.log("\n[7/15] Documents de vente");

  const customerIds = Object.values(THIRD_PARTY_MAP).slice(0, CFG.clientsCount);
  const productIds = Object.values(PRODUCT_MAP);
  const unitId = UNIT_MAP["U"] ?? null;
  const taxRateId20 = TAX_RATE_MAP[20] ?? null;
  const taxRateId10 = TAX_RATE_MAP[10] ?? null;
  const taxRateId14 = TAX_RATE_MAP[14] ?? null;
  const taxRateId0 = TAX_RATE_MAP[0] ?? null;

  if (customerIds.length === 0 || productIds.length === 0) {
    console.log("  ⚠️ Pas assez de clients/produits, ventes ignorées");
    return;
  }

  // Quotes
  const quotes: Record<string, unknown>[] = [];
  const quoteLines: Record<string, unknown>[] = [];
  const quoteStatuses = ["draft", "sent", "accepted", "rejected", "converted"];
  const quoteStatusCounts = [Math.floor(CFG.quotesCount * 0.13), Math.floor(CFG.quotesCount * 0.23), Math.floor(CFG.quotesCount * 0.27), Math.floor(CFG.quotesCount * 0.1), Math.floor(CFG.quotesCount * 0.27)];

  let quoteIdx = 0;
  for (let s = 0; s < quoteStatuses.length; s++) {
    for (let i = 0; i < quoteStatusCounts[s]; i++) {
      const customerId = randChoice(customerIds);
      const month = randInt(0, 11);
      const day = randInt(1, 28);
      const date = new Date(2026, month, day);
      const docNum = `DEV-DEMO-${String(quoteIdx + 1).padStart(5, "0")}`;
      const lineCount = randInt(1, 4);
      let subtotal = 0;
      let taxTotal = 0;

      for (let l = 0; l < lineCount; l++) {
        const pId = randChoice(productIds);
        const qty = randInt(1, 10);
        const price = randInt(100, 5000);
        const taxRate = randChoice([20, 20, 20, 10, 14, 0]);
        const lineSub = qty * price;
        const lineTax = Math.round(lineSub * taxRate / 100 * 100) / 100;
        const lineTotal = lineSub + lineTax;
        const taxRId = taxRate === 20 ? taxRateId20 : taxRate === 10 ? taxRateId10 : taxRate === 14 ? taxRateId14 : taxRateId0;

        quoteLines.push({
          organization_id: DEMO_ORG_ID,
          document_id: "QUOTE_PLACEHOLDER", // Will be replaced
          line_order: l + 1,
          product_id: pId,
          product_name: `Produit ${l + 1}`,
          description: `Ligne ${l + 1}`,
          quantity: qty,
          unit_id: unitId,
          unit_price_ht: price,
          tax_rate_id: taxRId,
          tax_rate: taxRate,
          subtotal_ht: lineSub,
          tax_amount: lineTax,
          total_ttc: lineTotal,
          created_at: date.toISOString(),
        });
        subtotal += lineSub;
        taxTotal += lineTax;
      }

      quotes.push({
        organization_id: DEMO_ORG_ID,
        document_type: "quote",
        document_number: docNum,
        customer_id: customerId,
        document_date: formatDate(date),
        status: quoteStatuses[s],
        subtotal_ht: Math.round(subtotal * 100) / 100,
        tax_total: Math.round(taxTotal * 100) / 100,
        total_ttc: Math.round((subtotal + taxTotal) * 100) / 100,
        notes: `Devis démo ${quoteIdx + 1}`,
        created_at: date.toISOString(),
      });
      quoteIdx++;
    }
  }

  // Insert quotes and get IDs
  const { data: insertedQuotes } = await supabase.from("sales_documents").insert(quotes).select("id, document_number");
  const quoteIdMap: Record<string, string> = {};
  for (const q of insertedQuotes ?? []) quoteIdMap[q.document_number] = q.id;

  // Update quote lines with real IDs
  for (const line of quoteLines) {
    const docNum = quotes[quoteLines.indexOf(line) % quotes.length]?.document_number as string | undefined;
    if (docNum && quoteIdMap[docNum]) {
      line.document_id = quoteIdMap[docNum];
    }
  }
  await batchInsert("sales_document_lines", quoteLines);
  console.log(`  ✅ ${quotes.length} devis créés`);

  // Sales orders (linked from accepted quotes or standalone)
  const orders: Record<string, unknown>[] = [];
  const orderLines: Record<string, unknown>[] = [];
  const orderStatuses = ["draft", "confirmed", "partially_delivered", "delivered", "cancelled"];
  const orderStatusCounts = [Math.floor(CFG.salesOrdersCount * 0.11), Math.floor(CFG.salesOrdersCount * 0.33), Math.floor(CFG.salesOrdersCount * 0.17), Math.floor(CFG.salesOrdersCount * 0.28), Math.floor(CFG.salesOrdersCount * 0.11)];

  let orderIdx = 0;
  for (let s = 0; s < orderStatuses.length; s++) {
    for (let i = 0; i < orderStatusCounts[s]; i++) {
      const customerId = randChoice(customerIds);
      const month = randInt(0, 11);
      const day = randInt(1, 28);
      const date = new Date(2026, month, day);
      const docNum = `CMD-DEMO-${String(orderIdx + 1).padStart(5, "0")}`;
      const lineCount = randInt(1, 4);
      let subtotal = 0;
      let taxTotal = 0;

      for (let l = 0; l < lineCount; l++) {
        const pId = randChoice(productIds);
        const qty = randInt(1, 10);
        const price = randInt(100, 5000);
        const taxRate = 20;
        const lineSub = qty * price;
        const lineTax = Math.round(lineSub * taxRate / 100 * 100) / 100;
        subtotal += lineSub;
        taxTotal += lineTax;

        orderLines.push({
          organization_id: DEMO_ORG_ID,
          document_id: "ORDER_PLACEHOLDER",
          line_order: l + 1,
          product_id: pId,
          product_name: `Produit ${l + 1}`,
          description: `Ligne ${l + 1}`,
          quantity: qty,
          unit_id: unitId,
          unit_price_ht: price,
          tax_rate_id: taxRateId20,
          tax_rate: taxRate,
          subtotal_ht: lineSub,
          tax_amount: lineTax,
          total_ttc: lineSub + lineTax,
          ordered_quantity: qty,
          remaining_quantity: qty,
          created_at: date.toISOString(),
        });
      }

      orders.push({
        organization_id: DEMO_ORG_ID,
        document_type: "order",
        document_number: docNum,
        customer_id: customerId,
        document_date: formatDate(date),
        status: orderStatuses[s],
        subtotal_ht: Math.round(subtotal * 100) / 100,
        tax_total: Math.round(taxTotal * 100) / 100,
        total_ttc: Math.round((subtotal + taxTotal) * 100) / 100,
        notes: `Commande démo ${orderIdx + 1}`,
        created_at: date.toISOString(),
      });
      orderIdx++;
    }
  }

  const { data: insertedOrders } = await supabase.from("sales_documents").insert(orders).select("id, document_number");
  const orderIdMap: Record<string, string> = {};
  for (const o of insertedOrders ?? []) orderIdMap[o.document_number] = o.id;

  for (const line of orderLines) {
    const docNum = orders[orderLines.indexOf(line) % orders.length]?.document_number as string | undefined;
    if (docNum && orderIdMap[docNum]) line.document_id = orderIdMap[docNum];
  }
  await batchInsert("sales_document_lines", orderLines);
  console.log(`  ✅ ${orders.length} commandes clients créées`);

  // Delivery notes (linked from orders)
  const deliveries: Record<string, unknown>[] = [];
  const deliveryLines: Record<string, unknown>[] = [];
  const deliveryStatuses = ["draft", "validated", "delivered"];
  const deliveryStatusCounts = [Math.floor(CFG.deliveryNotesCount * 0.11), Math.floor(CFG.deliveryNotesCount * 0.2), Math.floor(CFG.deliveryNotesCount * 0.69)];

  let deliveryIdx = 0;
  for (let s = 0; s < deliveryStatuses.length; s++) {
    for (let i = 0; i < deliveryStatusCounts[s]; i++) {
      const customerId = randChoice(customerIds);
      const month = randInt(0, 11);
      const day = randInt(1, 28);
      const date = new Date(2026, month, day);
      const docNum = `BL-DEMO-${String(deliveryIdx + 1).padStart(5, "0")}`;
      const lineCount = randInt(1, 3);
      let subtotal = 0;
      let taxTotal = 0;

      for (let l = 0; l < lineCount; l++) {
        const pId = randChoice(productIds);
        const qty = randInt(1, 5);
        const price = randInt(100, 5000);
        const lineSub = qty * price;
        const lineTax = Math.round(lineSub * 20 / 100 * 100) / 100;
        subtotal += lineSub;
        taxTotal += lineTax;

        deliveryLines.push({
          organization_id: DEMO_ORG_ID,
          document_id: "DELIVERY_PLACEHOLDER",
          line_order: l + 1,
          product_id: pId,
          product_name: `Produit ${l + 1}`,
          description: `Ligne ${l + 1}`,
          quantity: qty,
          unit_id: unitId,
          unit_price_ht: price,
          tax_rate_id: taxRateId20,
          tax_rate: 20,
          subtotal_ht: lineSub,
          tax_amount: lineTax,
          total_ttc: lineSub + lineTax,
          delivered_quantity: qty,
          created_at: date.toISOString(),
        });
      }

      deliveries.push({
        organization_id: DEMO_ORG_ID,
        document_type: "delivery_note",
        document_number: docNum,
        customer_id: customerId,
        document_date: formatDate(date),
        status: deliveryStatuses[s],
        subtotal_ht: Math.round(subtotal * 100) / 100,
        tax_total: Math.round(taxTotal * 100) / 100,
        total_ttc: Math.round((subtotal + taxTotal) * 100) / 100,
        notes: `BL démo ${deliveryIdx + 1}`,
        created_at: date.toISOString(),
      });
      deliveryIdx++;
    }
  }

  const { data: insertedDeliveries } = await supabase.from("sales_documents").insert(deliveries).select("id, document_number");
  const deliveryIdMap: Record<string, string> = {};
  for (const d of insertedDeliveries ?? []) deliveryIdMap[d.document_number] = d.id;

  for (const line of deliveryLines) {
    const docNum = deliveries[deliveryLines.indexOf(line) % deliveries.length]?.document_number as string | undefined;
    if (docNum && deliveryIdMap[docNum]) line.document_id = deliveryIdMap[docNum];
  }
  await batchInsert("sales_document_lines", deliveryLines);
  console.log(`  ✅ ${deliveries.length} bons de livraison créés`);

  // Customer invoices
  const invoices: Record<string, unknown>[] = [];
  const invoiceLines: Record<string, unknown>[] = [];
  const invoiceStatuses = ["draft", "validated", "sent", "partially_paid", "paid", "overdue"];
  const invoiceStatusCounts = [Math.floor(CFG.customerInvoicesCount * 0.06), Math.floor(CFG.customerInvoicesCount * 0.24), Math.floor(CFG.customerInvoicesCount * 0.18), Math.floor(CFG.customerInvoicesCount * 0.18), Math.floor(CFG.customerInvoicesCount * 0.29), Math.floor(CFG.customerInvoicesCount * 0.05)];

  let invoiceIdx = 0;
  for (let s = 0; s < invoiceStatuses.length; s++) {
    for (let i = 0; i < invoiceStatusCounts[s]; i++) {
      const customerId = randChoice(customerIds);
      const month = randInt(0, 11);
      const day = randInt(1, 28);
      const date = new Date(2026, month, day);
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + randInt(15, 60));
      const docNum = `FAC-DEMO-${String(invoiceIdx + 1).padStart(5, "0")}`;
      const lineCount = randInt(1, 4);
      let subtotal = 0;
      let taxTotal = 0;

      for (let l = 0; l < lineCount; l++) {
        const pId = randChoice(productIds);
        const qty = randInt(1, 10);
        const price = randInt(100, 5000);
        const taxRate = randChoice([20, 20, 20, 10, 14, 0]);
        const lineSub = qty * price;
        const lineTax = Math.round(lineSub * taxRate / 100 * 100) / 100;
        const taxRId = taxRate === 20 ? taxRateId20 : taxRate === 10 ? taxRateId10 : taxRate === 14 ? taxRateId14 : taxRateId0;
        subtotal += lineSub;
        taxTotal += lineTax;

        invoiceLines.push({
          organization_id: DEMO_ORG_ID,
          invoice_id: "INVOICE_PLACEHOLDER",
          line_order: l + 1,
          product_id: pId,
          product_name: `Produit ${l + 1}`,
          description: `Ligne ${l + 1}`,
          quantity: qty,
          unit_id: unitId,
          unit_price_ht: price,
          tax_rate_id: taxRId,
          tax_rate: taxRate,
          subtotal_ht: lineSub,
          discount_amount: 0,
          tax_amount: lineTax,
          total_ttc: lineSub + lineTax,
          created_at: date.toISOString(),
        });
      }

      const totalTtc = Math.round((subtotal + taxTotal) * 100) / 100;
      const status = invoiceStatuses[s];
      const paidAmount = status === "paid" ? totalTtc : status === "partially_paid" ? Math.round(totalTtc * 0.4 * 100) / 100 : 0;

      invoices.push({
        organization_id: DEMO_ORG_ID,
        invoice_number: docNum,
        customer_id: customerId,
        invoice_date: formatDate(date),
        due_date: formatDate(dueDate),
        status,
        payment_status: status === "paid" ? "paid" : status === "partially_paid" ? "partial" : "unpaid",
        payment_terms_days: randInt(15, 60),
        subtotal_ht: Math.round(subtotal * 100) / 100,
        discount_total: 0,
        tax_total: Math.round(taxTotal * 100) / 100,
        total_ttc: totalTtc,
        paid_amount: paidAmount,
        remaining_amount: Math.round((totalTtc - paidAmount) * 100) / 100,
        currency: "MAD",
        notes: `Facture démo ${invoiceIdx + 1}`,
        created_at: date.toISOString(),
      });
      invoiceIdx++;
    }
  }

  const { data: insertedInvoices } = await supabase.from("customer_invoices").insert(invoices).select("id, invoice_number");
  const invoiceIdMap: Record<string, string> = {};
  for (const inv of insertedInvoices ?? []) invoiceIdMap[inv.invoice_number] = inv.id;

  for (const line of invoiceLines) {
    const docNum = invoices[invoiceLines.indexOf(line) % invoices.length]?.invoice_number as string | undefined;
    if (docNum && invoiceIdMap[docNum]) line.invoice_id = invoiceIdMap[docNum];
  }
  await batchInsert("customer_invoice_lines", invoiceLines);
  console.log(`  ✅ ${invoices.length} factures clients créées`);

  // Customer credit notes
  const creditNotes: Record<string, unknown>[] = [];
  const creditNoteLines: Record<string, unknown>[] = [];

  for (let i = 0; i < CFG.customerCreditNotesCount; i++) {
    const customerId = randChoice(customerIds);
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);
    const docNum = `AV-DEMO-${String(i + 1).padStart(5, "0")}`;
    const lineCount = randInt(1, 2);
    let subtotal = 0;
    let taxTotal = 0;

    for (let l = 0; l < lineCount; l++) {
      const pId = randChoice(productIds);
      const qty = randInt(1, 3);
      const price = randInt(100, 2000);
      const lineSub = qty * price;
      const lineTax = Math.round(lineSub * 20 / 100 * 100) / 100;
      subtotal += lineSub;
      taxTotal += lineTax;

      creditNoteLines.push({
        organization_id: DEMO_ORG_ID,
        credit_note_id: "CN_PLACEHOLDER",
        line_order: l + 1,
        product_id: pId,
        product_name: `Produit ${l + 1}`,
        description: `Ligne avoir ${l + 1}`,
        quantity: qty,
        unit_id: unitId,
        unit_price_ht: price,
        tax_rate_id: taxRateId20,
        tax_rate: 20,
        subtotal_ht: lineSub,
        discount_amount: 0,
        tax_amount: lineTax,
        total_ttc: lineSub + lineTax,
        created_at: date.toISOString(),
      });
    }

    const totalTtc = Math.round((subtotal + taxTotal) * 100) / 100;
    creditNotes.push({
      organization_id: DEMO_ORG_ID,
      credit_note_number: docNum,
      customer_id: customerId,
      credit_note_date: formatDate(date),
      status: randChoice(["draft", "validated", "applied"]),
      subtotal_ht: Math.round(subtotal * 100) / 100,
      discount_total: 0,
      tax_total: Math.round(taxTotal * 100) / 100,
      total_ttc: totalTtc,
      applied_amount: 0,
      available_amount: totalTtc,
      currency: "MAD",
      notes: `Avoir client démo ${i + 1}`,
      created_at: date.toISOString(),
    });
  }

  const { data: insertedCNs } = await supabase.from("customer_credit_notes").insert(creditNotes).select("id, credit_note_number");
  const cnIdMap: Record<string, string> = {};
  for (const cn of insertedCNs ?? []) cnIdMap[cn.credit_note_number] = cn.id;

  for (const line of creditNoteLines) {
    const docNum = creditNotes[creditNoteLines.indexOf(line) % creditNotes.length]?.credit_note_number as string | undefined;
    if (docNum && cnIdMap[docNum]) line.credit_note_id = cnIdMap[docNum];
  }
  await batchInsert("customer_credit_note_lines", creditNoteLines);
  console.log(`  ✅ ${creditNotes.length} avoirs clients créés`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 20. PURCHASE DOCUMENTS (MASSIVE)
// ═══════════════════════════════════════════════════════════════════════════════
async function seedPurchaseDocuments() {
  console.log("\n[8/15] Documents d'achat");

  const supplierIds = Object.values(THIRD_PARTY_MAP).slice(CFG.clientsCount + CFG.prospectsCount, CFG.clientsCount + CFG.prospectsCount + CFG.suppliersCount);
  const productIds = Object.values(PRODUCT_MAP);
  const unitId = UNIT_MAP["U"] ?? null;
  const taxRateId20 = TAX_RATE_MAP[20] ?? null;

  if (supplierIds.length === 0 || productIds.length === 0) {
    console.log("  ⚠️ Pas assez de fournisseurs/produits, achats ignorés");
    return;
  }

  // Purchase orders
  const orders: Record<string, unknown>[] = [];
  const orderLines: Record<string, unknown>[] = [];
  const orderStatuses = ["draft", "sent", "confirmed", "partially_received", "received", "cancelled"];
  const orderStatusCounts = [Math.floor(CFG.purchaseOrdersCount * 0.1), Math.floor(CFG.purchaseOrdersCount * 0.15), Math.floor(CFG.purchaseOrdersCount * 0.25), Math.floor(CFG.purchaseOrdersCount * 0.17), Math.floor(CFG.purchaseOrdersCount * 0.25), Math.floor(CFG.purchaseOrdersCount * 0.08)];

  let orderIdx = 0;
  for (let s = 0; s < orderStatuses.length; s++) {
    for (let i = 0; i < orderStatusCounts[s]; i++) {
      const supplierId = randChoice(supplierIds);
      const month = randInt(0, 11);
      const day = randInt(1, 28);
      const date = new Date(2026, month, day);
      const docNum = `CF-DEMO-${String(orderIdx + 1).padStart(5, "0")}`;
      const lineCount = randInt(1, 4);
      let subtotal = 0;
      let taxTotal = 0;

      for (let l = 0; l < lineCount; l++) {
        const pId = randChoice(productIds);
        const qty = randInt(5, 50);
        const price = randInt(50, 2000);
        const lineSub = qty * price;
        const lineTax = Math.round(lineSub * 20 / 100 * 100) / 100;
        subtotal += lineSub;
        taxTotal += lineTax;

        orderLines.push({
          organization_id: DEMO_ORG_ID,
          document_id: "PO_PLACEHOLDER",
          line_order: l + 1,
          product_id: pId,
          product_name: `Produit ${l + 1}`,
          description: `Ligne ${l + 1}`,
          quantity: qty,
          unit_id: unitId,
          unit_price_ht: price,
          tax_rate_id: taxRateId20,
          tax_rate: 20,
          subtotal_ht: lineSub,
          discount_amount: 0,
          tax_amount: lineTax,
          total_ttc: lineSub + lineTax,
          ordered_quantity: qty,
          remaining_quantity: qty,
          created_at: date.toISOString(),
        });
      }

      orders.push({
        organization_id: DEMO_ORG_ID,
        document_type: "supplier_order",
        document_number: docNum,
        supplier_id: supplierId,
        document_date: formatDate(date),
        status: orderStatuses[s],
        subtotal_ht: Math.round(subtotal * 100) / 100,
        discount_total: 0,
        tax_total: Math.round(taxTotal * 100) / 100,
        total_ttc: Math.round((subtotal + taxTotal) * 100) / 100,
        currency: "MAD",
        notes: `Commande fournisseur démo ${orderIdx + 1}`,
        created_at: date.toISOString(),
      });
      orderIdx++;
    }
  }

  const { data: insertedOrders } = await supabase.from("purchase_documents").insert(orders).select("id, document_number");
  const orderIdMap: Record<string, string> = {};
  for (const o of insertedOrders ?? []) orderIdMap[o.document_number] = o.id;

  for (const line of orderLines) {
    const docNum = orders[orderLines.indexOf(line) % orders.length]?.document_number as string | undefined;
    if (docNum && orderIdMap[docNum]) line.document_id = orderIdMap[docNum];
  }
  await batchInsert("purchase_document_lines", orderLines);
  console.log(`  ✅ ${orders.length} commandes fournisseurs créées`);

  // Supplier receipts
  const receipts: Record<string, unknown>[] = [];
  const receiptLines: Record<string, unknown>[] = [];
  const receiptStatuses = ["draft", "validated"];
  const receiptStatusCounts = [Math.floor(CFG.purchaseReceiptsCount * 0.15), Math.floor(CFG.purchaseReceiptsCount * 0.85)];
  const orderIdsForReceipts = (insertedOrders ?? []).map((o) => o.id);

  let receiptIdx = 0;
  for (let s = 0; s < receiptStatuses.length; s++) {
    for (let i = 0; i < receiptStatusCounts[s]; i++) {
      const supplierId = randChoice(supplierIds);
      const month = randInt(0, 11);
      const day = randInt(1, 28);
      const date = new Date(2026, month, day);
      const docNum = `REC-DEMO-${String(receiptIdx + 1).padStart(5, "0")}`;
      const lineCount = randInt(1, 4);
      let subtotal = 0;
      let taxTotal = 0;
      const linkedOrderId = orderIdsForReceipts.length > 0 && Math.random() < 0.3 ? randChoice(orderIdsForReceipts) : null;
      const whId = randChoice(Object.values(WAREHOUSE_MAP));

      for (let l = 0; l < lineCount; l++) {
        const pId = randChoice(productIds);
        const qty = randInt(5, 50);
        const price = randInt(50, 2000);
        const lineSub = qty * price;
        const lineTax = Math.round(lineSub * 20 / 100 * 100) / 100;
        subtotal += lineSub;
        taxTotal += lineTax;

        receiptLines.push({
          organization_id: DEMO_ORG_ID,
          document_id: "REC_PLACEHOLDER",
          line_order: l + 1,
          product_id: pId,
          product_name: `Produit ${l + 1}`,
          description: `Ligne ${l + 1}`,
          quantity: qty,
          unit_id: unitId,
          unit_price_ht: price,
          tax_rate_id: taxRateId20,
          tax_rate: 20,
          subtotal_ht: lineSub,
          discount_amount: 0,
          tax_amount: lineTax,
          total_ttc: lineSub + lineTax,
          received_quantity: qty,
          created_at: date.toISOString(),
        });
      }

      receipts.push({
        organization_id: DEMO_ORG_ID,
        document_type: "supplier_receipt",
        document_number: docNum,
        supplier_id: supplierId,
        source_document_id: linkedOrderId,
        related_order_id: linkedOrderId,
        document_date: formatDate(date),
        status: receiptStatuses[s],
        subtotal_ht: Math.round(subtotal * 100) / 100,
        discount_total: 0,
        tax_total: Math.round(taxTotal * 100) / 100,
        total_ttc: Math.round((subtotal + taxTotal) * 100) / 100,
        currency: "MAD",
        warehouse_id: whId,
        stock_updated_at: receiptStatuses[s] === "validated" ? date.toISOString() : null,
        notes: `Réception fournisseur démo ${receiptIdx + 1}`,
        created_at: date.toISOString(),
      });
      receiptIdx++;
    }
  }

  const { data: insertedReceipts } = await supabase.from("purchase_documents").insert(receipts).select("id, document_number");
  const receiptIdMap: Record<string, string> = {};
  for (const r of insertedReceipts ?? []) receiptIdMap[r.document_number] = r.id;

  for (const line of receiptLines) {
    const docNum = receipts[receiptLines.indexOf(line) % receipts.length]?.document_number as string | undefined;
    if (docNum && receiptIdMap[docNum]) line.document_id = receiptIdMap[docNum];
  }
  await batchInsert("purchase_document_lines", receiptLines);

  // Create stock moves for validated receipts
  const validatedReceipts = (insertedReceipts ?? []).filter((_, idx) => receipts[idx]?.status === "validated");
  const stockMovesForReceipts: Record<string, unknown>[] = [];
  for (const rec of validatedReceipts) {
    const recLines = receiptLines.filter((l) => l.document_id === rec.id);
    for (const line of recLines) {
      stockMovesForReceipts.push({
        organization_id: DEMO_ORG_ID,
        product_id: line.product_id,
        warehouse_id: line.warehouse_id ?? randChoice(Object.values(WAREHOUSE_MAP)),
        quantity: line.quantity,
        direction: "in",
        move_type: "purchase_receipt",
        source_document_id: rec.id,
        movement_date: line.created_at,
        notes: `Stock move for receipt ${rec.document_number}`,
      });
    }
  }
  if (stockMovesForReceipts.length > 0) {
    await batchInsert("stock_moves", stockMovesForReceipts);
  }

  console.log(`  ✅ ${receipts.length} réceptions fournisseurs créées (${stockMovesForReceipts.length} mouvements de stock)`);

  // Supplier invoices
  const invoices: Record<string, unknown>[] = [];
  const invoiceLines: Record<string, unknown>[] = [];
  const invoiceStatuses = ["draft", "validated", "partially_paid", "paid", "cancelled"];
  const invoiceStatusCounts = [Math.floor(CFG.supplierInvoicesCount * 0.08), Math.floor(CFG.supplierInvoicesCount * 0.31), Math.floor(CFG.supplierInvoicesCount * 0.15), Math.floor(CFG.supplierInvoicesCount * 0.38), Math.floor(CFG.supplierInvoicesCount * 0.08)];

  let invoiceIdx = 0;
  for (let s = 0; s < invoiceStatuses.length; s++) {
    for (let i = 0; i < invoiceStatusCounts[s]; i++) {
      const supplierId = randChoice(supplierIds);
      const month = randInt(0, 11);
      const day = randInt(1, 28);
      const date = new Date(2026, month, day);
      const dueDate = new Date(date);
      dueDate.setDate(dueDate.getDate() + randInt(15, 90));
      const docNum = `FF-DEMO-${String(invoiceIdx + 1).padStart(5, "0")}`;
      const lineCount = randInt(1, 4);
      let subtotal = 0;
      let taxTotal = 0;

      for (let l = 0; l < lineCount; l++) {
        const pId = randChoice(productIds);
        const qty = randInt(5, 50);
        const price = randInt(50, 2000);
        const lineSub = qty * price;
        const lineTax = Math.round(lineSub * 20 / 100 * 100) / 100;
        subtotal += lineSub;
        taxTotal += lineTax;

        invoiceLines.push({
          organization_id: DEMO_ORG_ID,
          invoice_id: "SI_PLACEHOLDER",
          line_order: l + 1,
          product_id: pId,
          product_name: `Produit ${l + 1}`,
          description: `Ligne ${l + 1}`,
          quantity: qty,
          unit_id: unitId,
          unit_price_ht: price,
          tax_rate_id: taxRateId20,
          tax_rate: 20,
          subtotal_ht: lineSub,
          discount_amount: 0,
          tax_amount: lineTax,
          total_ttc: lineSub + lineTax,
          created_at: date.toISOString(),
        });
      }

      const totalTtc = Math.round((subtotal + taxTotal) * 100) / 100;
      const status = invoiceStatuses[s];
      const paidAmount = status === "paid" ? totalTtc : status === "partially_paid" ? Math.round(totalTtc * 0.5 * 100) / 100 : 0;
      const linkedReceiptId = (insertedReceipts ?? []).length > 0 && Math.random() < 0.5 && status !== "cancelled" ? randChoice(insertedReceipts ?? []).id : null;

      invoices.push({
        organization_id: DEMO_ORG_ID,
        invoice_number: docNum,
        supplier_invoice_number: `FOURN-${invoiceIdx + 1}`,
        supplier_id: supplierId,
        source_receipt_id: linkedReceiptId,
        invoice_date: formatDate(date),
        due_date: formatDate(dueDate),
        status,
        payment_status: status === "paid" ? "paid" : status === "partially_paid" ? "partial" : "unpaid",
        subtotal_ht: Math.round(subtotal * 100) / 100,
        discount_total: 0,
        tax_total: Math.round(taxTotal * 100) / 100,
        total_ttc: totalTtc,
        paid_amount: paidAmount,
        remaining_amount: Math.round((totalTtc - paidAmount) * 100) / 100,
        currency: "MAD",
        notes: `Facture fournisseur démo ${invoiceIdx + 1}`,
        created_at: date.toISOString(),
      });
      invoiceIdx++;
    }
  }

  const { data: insertedInvoices } = await supabase.from("supplier_invoices").insert(invoices).select("id, invoice_number");
  const invoiceIdMap: Record<string, string> = {};
  for (const inv of insertedInvoices ?? []) invoiceIdMap[inv.invoice_number] = inv.id;

  for (const line of invoiceLines) {
    const docNum = invoices[invoiceLines.indexOf(line) % invoices.length]?.invoice_number as string | undefined;
    if (docNum && invoiceIdMap[docNum]) line.invoice_id = invoiceIdMap[docNum];
  }
  await batchInsert("supplier_invoice_lines", invoiceLines);
  console.log(`  ✅ ${invoices.length} factures fournisseurs créées`);

  // Supplier credit notes
  const creditNotes: Record<string, unknown>[] = [];
  const scnLines: Record<string, unknown>[] = [];

  for (let i = 0; i < CFG.supplierCreditNotesCount; i++) {
    const supplierId = randChoice(supplierIds);
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);
    const docNum = `AVF-DEMO-${String(i + 1).padStart(5, "0")}`;
    const qty = randInt(1, 5);
    const price = randInt(50, 1000);
    const lineSub = qty * price;
    const lineTax = Math.round(lineSub * 20 / 100 * 100) / 100;

    scnLines.push({
      organization_id: DEMO_ORG_ID,
      invoice_id: "SCN_PLACEHOLDER",
      line_order: 1,
      product_id: randChoice(productIds),
      product_name: "Produit retourné",
      description: "Ligne avoir fournisseur",
      quantity: qty,
      unit_id: unitId,
      unit_price_ht: price,
      tax_rate_id: taxRateId20,
      tax_rate: 20,
      subtotal_ht: lineSub,
      discount_amount: 0,
      tax_amount: lineTax,
      total_ttc: lineSub + lineTax,
      created_at: date.toISOString(),
    });

    creditNotes.push({
      organization_id: DEMO_ORG_ID,
      invoice_number: docNum,
      supplier_id: supplierId,
      invoice_date: formatDate(date),
      status: "validated",
      subtotal_ht: lineSub,
      discount_total: 0,
      tax_total: lineTax,
      total_ttc: lineSub + lineTax,
      paid_amount: 0,
      remaining_amount: lineSub + lineTax,
      currency: "MAD",
      notes: `Avoir fournisseur démo ${i + 1}`,
      created_at: date.toISOString(),
    });
  }

  // Note: supplier_credit_notes table doesn't exist, so we skip the actual insert
  // But we create the metadata in the documents table later
  console.log(`  ℹ ${creditNotes.length} avoirs fournisseurs (metadata uniquement)`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 21. PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
async function seedPayments() {
  console.log("\n[9/15] Paiements");

  const customerIds = Object.values(THIRD_PARTY_MAP).slice(0, CFG.clientsCount);
  const supplierIds = Object.values(THIRD_PARTY_MAP).slice(CFG.clientsCount + CFG.prospectsCount, CFG.clientsCount + CFG.prospectsCount + CFG.suppliersCount);
  const treasuryIds = Object.values(TREASURY_MAP);

  // Customer payments
  const customerPayments: Record<string, unknown>[] = [];
  for (let i = 0; i < CFG.customerPaymentsCount; i++) {
    const customerId = randChoice(customerIds);
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);
    const amount = randInt(500, 50000);
    const paymentMethod = randChoice(["bank_transfer", "check", "cash", "card"]);

    customerPayments.push({
      organization_id: DEMO_ORG_ID,
      third_party_id: customerId,
      customer_id: customerId,
      payment_number: `REG-DEMO-${String(i + 1).padStart(5, "0")}`,
      payment_date: formatDate(date),
      amount,
      allocated_amount: 0,
      available_amount: amount,
      currency: "MAD",
      payment_method: paymentMethod,
      payment_type: randChoice(["customer_payment", "advance_payment", "deposit"]),
      reference: `REF-${i + 1}`,
      status: "confirmed",
      treasury_account_id: randChoice(treasuryIds),
      created_at: date.toISOString(),
    });
  }
  await batchInsert("customer_payments", customerPayments);
  console.log(`  ✅ ${customerPayments.length} paiements clients créés`);

  // Supplier payments
  const supplierPayments: Record<string, unknown>[] = [];
  for (let i = 0; i < CFG.supplierPaymentsCount; i++) {
    const supplierId = randChoice(supplierIds);
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);
    const amount = randInt(500, 50000);

    supplierPayments.push({
      organization_id: DEMO_ORG_ID,
      payment_number: `RFO-DEMO-${String(i + 1).padStart(5, "0")}`,
      supplier_id: supplierId,
      payment_date: formatDate(date),
      amount,
      allocated_amount: 0,
      available_amount: amount,
      currency: "MAD",
      payment_method: randChoice(["bank_transfer", "check"]),
      payment_type: "supplier_payment",
      reference: `REF-FOURN-${i + 1}`,
      status: "confirmed",
      treasury_account_id: randChoice(treasuryIds),
      created_at: date.toISOString(),
    });
  }
  await batchInsert("supplier_payments", supplierPayments);
  console.log(`  ✅ ${supplierPayments.length} paiements fournisseurs créés`);

  const { data: paidSupplierInvoices } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number, supplier_invoice_number, supplier_id, invoice_date, paid_amount, total_ttc")
    .eq("organization_id", DEMO_ORG_ID)
    .gt("paid_amount", 0)
    .is("archived_at", null);

  const linkedSupplierPayments = (paidSupplierInvoices ?? []).map((invoice, index) => {
    const amount = Math.round(Number(invoice.paid_amount ?? invoice.total_ttc ?? 0) * 100) / 100;
    return {
      organization_id: DEMO_ORG_ID,
      payment_number: `RFO-LINK-${String(index + 1).padStart(5, "0")}`,
      supplier_id: invoice.supplier_id,
      payment_date: invoice.invoice_date,
      amount,
      allocated_amount: amount,
      available_amount: 0,
      currency: "MAD",
      payment_method: index % 2 === 0 ? "bank_transfer" : "check",
      payment_type: "supplier_payment",
      reference: String(invoice.supplier_invoice_number ?? invoice.invoice_number ?? ""),
      status: "allocated",
      treasury_account_id: randChoice(treasuryIds),
      created_at: new Date(String(invoice.invoice_date)).toISOString(),
    };
  });

  if (linkedSupplierPayments.length > 0) {
    const { data: insertedLinkedPayments, error: linkedPaymentError } = await supabase
      .from("supplier_payments")
      .insert(linkedSupplierPayments)
      .select("id, payment_number, reference, amount, supplier_id, payment_date, treasury_account_id");

    if (linkedPaymentError) {
      console.error(`  ❌ paiements fournisseurs liés: ${linkedPaymentError.message}`);
    } else {
      const invoiceByReference = new Map((paidSupplierInvoices ?? []).map((invoice) => [String(invoice.supplier_invoice_number ?? invoice.invoice_number ?? ""), invoice]));
      const allocations = (insertedLinkedPayments ?? []).map((payment) => {
        const invoice = invoiceByReference.get(String(payment.reference ?? ""));
        return invoice ? {
          organization_id: DEMO_ORG_ID,
          payment_id: payment.id,
          invoice_id: invoice.id,
          supplier_id: invoice.supplier_id,
          allocation_date: payment.payment_date,
          amount: payment.amount,
          notes: "Affectation démo générée pour facture fournisseur payée",
          created_at: new Date(String(payment.payment_date)).toISOString(),
        } : null;
      }).filter(Boolean) as Record<string, unknown>[];

      await batchInsert("supplier_payment_allocations", allocations);

      const linkedTransactions = (insertedLinkedPayments ?? []).map((payment) => {
        const invoice = invoiceByReference.get(String(payment.reference ?? ""));
        return invoice ? {
          organization_id: DEMO_ORG_ID,
          treasury_account_id: payment.treasury_account_id,
          transaction_type: "supplier_payment",
          direction: "out",
          amount: payment.amount,
          currency: "MAD",
          transaction_date: payment.payment_date,
          label: `Paiement facture fournisseur ${payment.reference}`,
          reference: payment.reference,
          third_party_id: payment.supplier_id,
          supplier_payment_id: payment.id,
          supplier_invoice_id: invoice.id,
          reconciliation_status: "unreconciled",
          created_at: new Date(String(payment.payment_date)).toISOString(),
        } : null;
      }).filter(Boolean) as Record<string, unknown>[];

      await batchInsert("treasury_transactions", linkedTransactions);
      console.log(`  ✅ ${allocations.length} affectations de paiements fournisseurs liées aux factures payées`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 22. TREASURY TRANSACTIONS & BANK STATEMENTS
// ═══════════════════════════════════════════════════════════════════════════════
async function seedTreasury() {
  console.log("\n[10/15] Trésorerie");

  const customerIds = Object.values(THIRD_PARTY_MAP).slice(0, CFG.clientsCount);
  const supplierIds = Object.values(THIRD_PARTY_MAP).slice(CFG.clientsCount + CFG.prospectsCount, CFG.clientsCount + CFG.prospectsCount + CFG.suppliersCount);
  const treasuryIds = Object.values(TREASURY_MAP);
  const bankAccountIds = [TREASURY_MAP["BANK-AWB"], TREASURY_MAP["BANK-BP"]].filter(Boolean);

  // Treasury transactions
  const transactions: Record<string, unknown>[] = [];
  const types: Array<{ type: string; direction: string; label: string }> = [
    { type: "customer_payment", direction: "in", label: "Encaissement client" },
    { type: "supplier_payment", direction: "out", label: "Paiement fournisseur" },
    { type: "manual_in", direction: "in", label: "Virement interne reçu" },
    { type: "manual_out", direction: "out", label: "Virement interne émis" },
    { type: "bank_fee", direction: "out", label: "Frais bancaires" },
    { type: "transfer_in", direction: "in", label: "Transfert caisse" },
    { type: "transfer_out", direction: "out", label: "Transfert banque" },
    { type: "opening_balance", direction: "in", label: "Solde d'ouverture" },
    { type: "adjustment", direction: "in", label: "Ajustement positif" },
    { type: "other", direction: "out", label: "Dépense diverse" },
  ];

  for (let i = 0; i < CFG.treasuryTransactionsCount; i++) {
    const tmpl = randChoice(types);
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);
    const amount = randInt(50, 50000);

    transactions.push({
      organization_id: DEMO_ORG_ID,
      treasury_account_id: randChoice(treasuryIds),
      transaction_type: tmpl.type,
      direction: tmpl.direction,
      amount,
      currency: "MAD",
      transaction_date: formatDate(date),
      label: `${tmpl.label} ${i + 1}`,
      reference: `REF-TR-${i + 1}`,
      third_party_id: randBool(0.6) ? randChoice([...customerIds, ...supplierIds]) : null,
      reconciliation_status: randChoice(["unreconciled", "unreconciled", "unreconciled", "reconciled"]),
      created_at: date.toISOString(),
    });
  }
  await batchInsert("treasury_transactions", transactions);
  console.log(`  ✅ ${transactions.length} transactions trésorerie créées`);

  // Bank statement imports (12 months)
  const bankStatements: Record<string, unknown>[] = [];
  for (let m = 0; m < CFG.bankStatementsCount; m++) {
    const bankId = randChoice(bankAccountIds);
    if (!bankId) continue;
    bankStatements.push({
      organization_id: DEMO_ORG_ID,
      treasury_account_id: bankId,
      file_name: `Relevé_${String(m + 1).padStart(2, "0")}_2026.pdf`,
      period_start: `2026-${String(m + 1).padStart(2, "0")}-01`,
      period_end: m === 11 ? "2026-12-31" : `2026-${String(m + 2).padStart(2, "0")}-01`,
      imported_lines_count: 0,
      matched_lines_count: 0,
      unmatched_lines_count: 0,
      status: randChoice(["imported", "partially_reconciled", "reconciled"]),
      imported_at: new Date(2026, m, 15).toISOString(),
      created_at: new Date(2026, m, 15).toISOString(),
    });
  }

  const { data: insertedBS } = await supabase.from("bank_statement_imports").insert(bankStatements).select("id");
  console.log(`  ✅ ${bankStatements.length} relevés bancaires créés`);

  // Bank statement lines
  const bsLines: Record<string, unknown>[] = [];
  const statementIds = (insertedBS ?? []).map((b) => b.id);

  for (let i = 0; i < CFG.bankStatementLinesCount; i++) {
    const statementId = randChoice(statementIds);
    const bankId = randChoice(bankAccountIds);
    if (!statementId || !bankId) continue;
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);
    const direction = randChoice(["in", "out"]);
    const amount = randInt(50, 25000);

    bsLines.push({
      organization_id: DEMO_ORG_ID,
      import_id: statementId,
      treasury_account_id: bankId,
      operation_date: formatDate(date),
      label: `Opération bancaire ${i + 1}`,
      reference: `OP-${i + 1}`,
      debit_amount: direction === "out" ? amount : 0,
      credit_amount: direction === "in" ? amount : 0,
      amount,
      direction,
      reconciliation_status: randChoice(["unreconciled", "unreconciled", "reconciled", "ignored"]),
      created_at: date.toISOString(),
    });
  }
  await batchInsert("bank_statement_lines", bsLines);
  console.log(`  ✅ ${bsLines.length} lignes de relevé créées`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 23. ACCOUNTING ENTRIES (MASSIVE)
// ═══════════════════════════════════════════════════════════════════════════════
async function seedAccountingEntries() {
  console.log("\n[11/15] Comptabilité");

  const journalIds = Object.values(JOURNAL_MAP);
  if (journalIds.length === 0) {
    console.log("  ⚠️ Pas de journaux, comptabilité ignorée");
    return;
  }

  // Initialize entry counters
  for (const code of Object.keys(JOURNAL_MAP)) {
    ENTRY_COUNTER[code] = 0;
  }

  const entries: Record<string, unknown>[] = [];
  const entryLines: Record<string, unknown>[] = [];

  for (let i = 0; i < CFG.accountingEntriesCount; i++) {
    const journalCode = randChoice(Object.keys(JOURNAL_MAP));
    const journalId = JOURNAL_MAP[journalCode];
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);
    ENTRY_COUNTER[journalCode]++;
    const entryNum = `${journalCode}-2026-${String(ENTRY_COUNTER[journalCode]).padStart(5, "0")}`;
    const status = randChoice(["draft", "posted", "posted", "posted", "posted", "posted", "posted", "posted"]);

    // Generate 2-4 lines per entry
    const lineCount = randInt(2, 4);
    let totalDebit = 0;
    let totalCredit = 0;

    const currentLines: Record<string, unknown>[] = [];
    for (let l = 0; l < lineCount; l++) {
      const accountCode = randChoice(Object.keys(ACCOUNT_MAP));
      const accountId = ACCOUNT_MAP[accountCode];
      const amount = randInt(100, 50000);
      const isDebit = l === 0 || randBool(0.5);

      currentLines.push({
        organization_id: DEMO_ORG_ID,
        line_number: l + 1,
        account_id: accountId,
        account_code: accountCode,
        account_label: `Compte ${accountCode}`,
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
        label: `Ligne comptable ${i + 1}.${l + 1}`,
        reconciliation_status: "none",
        created_at: date.toISOString(),
      });

      if (isDebit) totalDebit += amount;
      else totalCredit += amount;
    }

    // Balance the entry
    const diff = totalDebit - totalCredit;
    if (Math.abs(diff) > 0.01) {
      // Add balancing line
      const balanceAccount = randChoice(["3421", "4411", "5141", "5161"]);
      const balanceId = ACCOUNT_MAP[balanceAccount];
      currentLines.push({
        organization_id: DEMO_ORG_ID,
        line_number: currentLines.length + 1,
        account_id: balanceId,
        account_code: balanceAccount,
        account_label: `Compte ${balanceAccount}`,
        debit: diff < 0 ? Math.abs(diff) : 0,
        credit: diff > 0 ? diff : 0,
        label: "Équilibrage",
        reconciliation_status: "none",
        created_at: date.toISOString(),
      });
      if (diff < 0) totalDebit += Math.abs(diff);
      else totalCredit += diff;
    }

    entries.push({
      organization_id: DEMO_ORG_ID,
      entry_number: entryNum,
      journal_id: journalId,
      entry_date: formatDate(date),
      label: `Écriture démo ${i + 1}`,
      status,
      total_debit: Math.round(totalDebit * 100) / 100,
      total_credit: Math.round(totalCredit * 100) / 100,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      posted_by: status === "posted" ? DEMO_USER_ID : null,
      posted_at: status === "posted" ? date.toISOString() : null,
    });

    // Store lines temporarily, will link after entry insert
    entryLines.push(...currentLines.map((line) => ({ ...line, _entryIndex: entries.length - 1 })));
  }

  const { data: insertedEntries } = await supabase.from("accounting_entries").insert(entries).select("id");
  console.log(`  ✅ ${entries.length} écritures comptables créées`);

  // Link lines to entries
  const finalLines = entryLines.map((line) => {
    const entryId = insertedEntries?.[line._entryIndex as number]?.id;
    const copy = { ...line, entry_id: entryId };
    delete (copy as Record<string, unknown>)._entryIndex;
    return copy;
  }).filter((line) => line.entry_id);

  await batchInsert("accounting_entry_lines", finalLines);
  console.log(`  ✅ ${finalLines.length} lignes comptables créées`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 24. VAT EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════
async function seedVatExports() {
  console.log("\n[12/15] TVA / Exports");

  const monthlyExports: Record<string, unknown>[] = [];
  for (let m = 0; m < CFG.vatMonthlyExportsCount; m++) {
    const month = m % 12;
    const year = 2026;
    const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const periodEnd = month === 11 ? `${year}-12-31` : `${year}-${String(month + 2).padStart(2, "0")}-01`;

    monthlyExports.push({
      organization_id: DEMO_ORG_ID,
      export_number: `TVA-M-${String(m + 1).padStart(3, "0")}-2026`,
      export_type: "dgi_vat_xml_prep",
      period_start: periodStart,
      period_end: periodEnd,
      format: "xml",
      status: randChoice(["draft", "generated", "generated_with_warnings", "preflight_failed"]),
      frequency: "monthly",
      idempotency_key: `demo-vat-monthly-${m + 1}-2026`,
      source_snapshot_hash: `hash-${m + 1}`,
      schema_version: "felexia-prep-1.0",
      file_bucket: "tax-exports",
      warnings: randBool(0.3) ? ["SUPPLIER_ICE_MISSING", "CUSTOMER_ICE_MISSING"] : [],
      validation_errors: randBool(0.2) ? [{ code: "TVA_MISMATCH", message: "Écart TVA détecté" }] : [],
      generated_at: new Date(2026, month, 25).toISOString(),
      created_at: new Date(2026, month, 25).toISOString(),
    });
  }
  await batchInsert("tax_export_batches", monthlyExports);
  console.log(`  ✅ ${monthlyExports.length} exports TVA mensuels créés`);

  // Quarterly exports
  const quarterlyExports: Record<string, unknown>[] = [];
  for (let q = 0; q < CFG.vatQuarterlyExportsCount; q++) {
    const startMonth = q * 3;
    const periodStart = `2026-${String(startMonth + 1).padStart(2, "0")}-01`;
    const periodEnd = startMonth === 9 ? "2026-12-31" : `2026-${String(startMonth + 4).padStart(2, "0")}-01`;

    quarterlyExports.push({
      organization_id: DEMO_ORG_ID,
      export_number: `TVA-T${q + 1}-2026`,
      export_type: "dgi_vat_xml_prep",
      period_start: periodStart,
      period_end: periodEnd,
      format: "xml",
      status: randChoice(["generated", "generated_with_warnings"]),
      frequency: "quarterly",
      idempotency_key: `demo-vat-quarterly-${q + 1}-2026`,
      source_snapshot_hash: `hash-q${q + 1}`,
      schema_version: "felexia-prep-1.0",
      file_bucket: "tax-exports",
      warnings: [],
      validation_errors: [],
      generated_at: new Date(2026, startMonth + 2, 25).toISOString(),
      created_at: new Date(2026, startMonth + 2, 25).toISOString(),
    });
  }
  await batchInsert("tax_export_batches", quarterlyExports);
  console.log(`  ✅ ${quarterlyExports.length} exports TVA trimestriels créés`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 25. DOCUMENTS METADATA
// ═══════════════════════════════════════════════════════════════════════════════
async function seedDocuments() {
  console.log("\n[13/15] Documents");

  const docTypes = ["quote", "customer_order", "delivery_note", "customer_invoice", "customer_credit_note", "supplier_order", "supplier_receipt", "supplier_invoice", "payment_receipt", "other"];
  const documents: Record<string, unknown>[] = [];

  for (let i = 0; i < CFG.documentsCount; i++) {
    const month = randInt(0, 11);
    const day = randInt(1, 28);
    const date = new Date(2026, month, day);

    documents.push({
      organization_id: DEMO_ORG_ID,
      name: `Document démo ${i + 1}`,
      document_type: randChoice(docTypes),
      origin: randChoice(["generated", "manual_import"]),
      linked_reference: `REF-DOC-${i + 1}`,
      file_url: null,
      file_path: null,
      mime_type: "application/pdf",
      file_size: randInt(10000, 500000),
      document_date: formatDate(date),
      status: randChoice(["available", "available", "available", "archived"]),
      description: `Document métier démo ${i + 1}`,
      metadata: { source: "demo_seed", index: i + 1 },
      created_at: date.toISOString(),
      title: `Document ${i + 1}`,
      file_name: `doc_${i + 1}.pdf`,
      size_bytes: randInt(10000, 500000),
      category: randChoice(["commercial", "comptable", "juridique", "rh", "divers"]),
    });
  }
  await batchInsert("documents", documents);
  console.log(`  ✅ ${documents.length} documents créés`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 26. INVITATIONS
// ═══════════════════════════════════════════════════════════════════════════════
async function seedInvitations() {
  console.log("\n[14/15] Invitations");

  const invitations = [
    { email: "commercial.demo@felexia.pro", role: "sales" },
    { email: "comptable.demo@felexia.pro", role: "accountant" },
    { email: "viewer.demo@felexia.pro", role: "viewer" },
    { email: "invitation.pending@felexia.pro", role: "sales" },
    { email: "comptable.pending@felexia.pro", role: "accountant" },
  ];

  // Get role IDs
  const { data: roles } = await supabase.from("roles").select("id, name").eq("organization_id", DEMO_ORG_ID);
  const roleMap: Record<string, string> = {};
  for (const r of roles ?? []) roleMap[r.name] = r.id;

  for (const inv of invitations) {
    const { data: existing } = await supabase.from("invitations").select("id").eq("organization_id", DEMO_ORG_ID).eq("email", inv.email).maybeSingle();
    if (existing) continue;

    await supabase.from("invitations").insert({
      organization_id: DEMO_ORG_ID,
      email: inv.email,
      role_id: roleMap[inv.role] ?? null,
      invited_by: DEMO_USER_ID,
      token: `demo-token-${inv.email.replace(/[@.]/g, "-")}-${Date.now()}`,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  console.log(`  ✅ ${invitations.length} invitations créées`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 27. SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
async function printSummary() {
  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  RÉSUMÉ — SOCIETE DEMO");
  console.log("══════════════════════════════════════════════════════════════════");

  const tables = [
    ["third_parties", "Tiers"],
    ["products", "Articles/Services"],
    ["sales_documents", "Documents de vente"],
    ["customer_invoices", "Factures clients"],
    ["customer_credit_notes", "Avoirs clients"],
    ["customer_payments", "Paiements clients"],
    ["purchase_documents", "Documents d'achat"],
    ["supplier_invoices", "Factures fournisseurs"],
    ["supplier_payments", "Paiements fournisseurs"],
    ["stock_moves", "Mouvements de stock"],
    ["treasury_transactions", "Transactions trésorerie"],
    ["bank_statement_imports", "Relevés bancaires"],
    ["bank_statement_lines", "Lignes de relevé"],
    ["accounting_entries", "Écritures comptables"],
    ["accounting_entry_lines", "Lignes comptables"],
    ["tax_export_batches", "Exports TVA"],
    ["documents", "Documents"],
    ["invitations", "Invitations"],
  ];

  let totalRecords = 0;
  for (const [table, label] of tables) {
    const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("organization_id", DEMO_ORG_ID);
    const c = count ?? 0;
    totalRecords += c;
    console.log(`  ${label.padEnd(30)} ${String(c).padStart(6)}`);
  }

  console.log("──────────────────────────────────────────────────────────────────");
  console.log(`  ${"TOTAL".padEnd(30)} ${String(totalRecords).padStart(6)}`);
  console.log("══════════════════════════════════════════════════════════════════");
  console.log(`
  Organisation  : ${ORG_NAME}
  Login         : ${DEMO_USER_EMAIL}
  Mot de passe  : ${DEMO_USER_PASSWORD}
  Échelle       : ${SCALE}

  ✅ Dossier démo prêt.
  ✅ Aucune donnée d'autres organisations modifiée.
  `);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 28. MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  SEED DEMO — SOCIETE DEMO");
  console.log(`  Échelle : ${SCALE.toUpperCase()}`);
  console.log("══════════════════════════════════════════════════════════════════");

  if (process.env.RESET_DEMO_ORG === "true") {
    await resetDemoOrg();
  }

  await ensureDemoUser();
  await ensureOrganization();
  await ensureCompanySettings();
  await ensureRolesAndMembership();
  await ensureBusinessTrialAndModules();
  await ensureReferenceData();
  await ensureWarehouses();
  await ensureTreasuryAccounts();
  await ensureAccountingBase();
  await ensureThirdParties();
  await ensureProducts();
  await ensureStock();
  await seedSalesDocuments();
  await seedPurchaseDocuments();
  await seedPayments();
  await seedTreasury();
  await seedAccountingEntries();
  await seedVatExports();
  await seedDocuments();
  await seedInvitations();
  await printSummary();

  console.log("\n✅ Seed terminé avec succès.");
}

main().catch((err) => {
  console.error("\n❌ Erreur fatale :", err);
  process.exit(1);
});
