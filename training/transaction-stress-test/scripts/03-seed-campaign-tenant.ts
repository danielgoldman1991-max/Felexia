/* SEED DU TENANT DE CAMPAGNE STRESS-FLX-2026-001 — idempotent.
 * Réplique le flux réel de register-company.ts (org + rôle admin + membership
 * + company_settings + essai Essentiel via ensureDefaultTrialAndModulesNoRevalidate)
 * puis ajoute : utilisateurs auth (14 profils), rôles, référentiel (unités,
 * entrepôts, trésorerie, tiers, produits).
 *
 * Utilisation : node --experimental-strip-types scripts/03-seed-campaign-tenant.ts
 *   RESET_CAMPAIGN=true  → supprime l'org de campagne existante + ses utilisateurs avant reseed
 * Preuve → ../database-checks/03_campaign_tenant_<ts>.txt + manifest JSON réutilisable.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getModulesForPlan } from "../../../src/lib/subscriptions/plan-modules.ts";
import { getDefaultTrialEndDate } from "../../../src/lib/subscriptions/trial-config.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.resolve(ROOT, "training/transaction-stress-test/database-checks");
const CAMPAIGN_SLUG = "stress-flx-2026-001";
const ORG_NAME = "ATLAS DISTRIBUTION & SERVICES TEST SARL AU";
const EMAIL_DOMAIN = "@stress-flx-2026-001.felexia-test.local";
const PASSWORD = process.env.CAMPAIGN_PASSWORD ?? "Stress-FLX-2026#Test";
const RESET = process.env.RESET_CAMPAIGN === "true";

function loadEnv(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

const env = loadEnv(path.join(ROOT, ".env.local"));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log: string[] = [];
const put = (s: string) => { log.push(s); console.log(s); };

const USERS: { key: string; role: string; fullName: string; membershipStatus: string }[] = [
  { key: "owner", role: "owner", fullName: "Youssef Alami", membershipStatus: "active" },
  { key: "admin", role: "admin", fullName: "Salma Benali", membershipStatus: "active" },
  { key: "accountant", role: "accountant", fullName: "Karim Idrissi", membershipStatus: "active" },
  { key: "acct-clients", role: "accountant", fullName: "Nadia Cherkaoui", membershipStatus: "active" },
  { key: "acct-suppliers", role: "accountant", fullName: "Mehdi Tazi", membershipStatus: "active" },
  { key: "sales", role: "sales", fullName: "Amina El Fassi", membershipStatus: "active" },
  { key: "purchase", role: "manager", fullName: "Omar Berrada", membershipStatus: "active" },
  { key: "warehouse-marrakech", role: "stock_user", fullName: "Hamza Ouazzani", membershipStatus: "active" },
  { key: "warehouse-casablanca", role: "stock_user", fullName: "Imane Bennis", membershipStatus: "active" },
  { key: "treasurer", role: "manager", fullName: "Rachid El Amrani", membershipStatus: "active" },
  { key: "cashier", role: "manager", fullName: "Fatima Zahra", membershipStatus: "active" },
  { key: "auditor", role: "viewer", fullName: "Sara Lahlou", membershipStatus: "active" },
  { key: "limited", role: "viewer", fullName: "Adil Mernissi", membershipStatus: "active" },
  { key: "suspended", role: "viewer", fullName: "Mounir Kabiri", membershipStatus: "disabled" },
];
const emailOf = (key: string) => `stress-flx-2026-001-${key}${EMAIL_DOMAIN}`;

async function fetchAll(t: string, columns: string, orderCol = "id") {
  const all: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin.from(t as any).select(columns).order(orderCol).range(from, from + 999);
    if (error) throw new Error(`${t}: ${error.message}`);
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
    from += 1000;
  }
  return all;
}

(async () => {
  // 0. Réinitialisation éventuelle (tenant de campagne uniquement)
  if (RESET) {
    const { data: existing } = await admin.from("organizations" as any).select("id").eq("slug", CAMPAIGN_SLUG).maybeSingle();
    if (existing) {
      const { error } = await admin.from("organizations" as any).delete().eq("id", existing.id);
      if (error) throw new Error(`reset org: ${error.message}`);
      put(`[reset] org de campagne supprimée (${existing.id})`);
    }
    const { data: doomed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of doomed?.users ?? []) {
      if (u.email?.endsWith(EMAIL_DOMAIN)) {
        const { error } = await admin.auth.admin.deleteUser(u.id);
        if (error) put(`[reset] user ${u.email} non supprimé: ${error.message}`);
        else put(`[reset] user ${u.email} supprimé`);
      }
    }
  }

  const ts = new Date().toISOString();
  const proof: string[] = [`Seed tenant de campagne ${ts}`, `org=${ORG_NAME} slug=${CAMPAIGN_SLUG}`, ""];

  // 1. Organisation
  let orgId: string | null = null;
  const { data: orgRow } = await admin.from("organizations" as any).select("id").eq("slug", CAMPAIGN_SLUG).maybeSingle();
  if (orgRow) {
    orgId = orgRow.id;
    put(`[org] existe déjà : ${orgId}`);
  } else {
    const { data: org, error } = await admin.from("organizations" as any).insert({
      name: ORG_NAME,
      slug: CAMPAIGN_SLUG,
      city: "Marrakech",
      currency: "MAD",
      onboarding_step: "completed",
      onboarding_completed: true,
      onboarding_completed_at: ts,
    }).select("id").single();
    if (error) throw new Error(`org insert: ${error.message}`);
    orgId = org.id;
    put(`[org] créée : ${orgId}`);
  }

  // 2. Utilisateurs auth + profils
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const email = emailOf(u.key);
    let userId = userIds[u.key] ?? null;
    const { data: existingUser } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const hit = existingUser?.users.find((x) => x.email === email);
    if (hit) {
      userId = hit.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName, role: u.role },
      });
      if (error) throw new Error(`auth create ${email}: ${error.message}`);
      userId = data.user.id;
    }
    userIds[u.key] = userId;
    await admin.from("profiles" as any).upsert({ id: userId, email, full_name: u.fullName, default_organization_id: orgId }, { onConflict: "id" });
  }

  // 3. Rôles
  const roleIds: Record<string, string> = {};
  const ROLES = [...new Set(USERS.map((u) => u.role))];
  for (const roleName of ROLES) {
    const { data: existing } = await admin.from("roles" as any).select("id").eq("organization_id", orgId).eq("name", roleName).maybeSingle();
    if (existing) { roleIds[roleName] = existing.id; continue; }
    const { data, error } = await admin.from("roles" as any).insert({ organization_id: orgId, name: roleName }).select("id").single();
    if (error) throw new Error(`role ${roleName}: ${error.message}`);
    roleIds[roleName] = data.id;
  }

  // 4. Memberships
  for (const u of USERS) {
    const { data: existing } = await admin.from("organization_members" as any).select("id").eq("organization_id", orgId).eq("user_id", userIds[u.key]).maybeSingle();
    if (existing) {
      await admin.from("organization_members" as any).update({ role_id: roleIds[u.role], status: u.membershipStatus }).eq("id", existing.id);
    } else {
      const { error } = await admin.from("organization_members" as any).insert({
        organization_id: orgId, user_id: userIds[u.key], role_id: roleIds[u.role], status: u.membershipStatus,
      });
      if (error) throw new Error(`membership ${u.key}: ${error.message}`);
    }
  }

  // 5. Company settings
  await admin.from("company_settings" as any).upsert({
    organization_id: orgId,
    legal_name: ORG_NAME,
    commercial_name: "ATLAS DISTRIBUTION",
    city: "Marrakech",
    country: "Maroc",
    currency: "MAD",
    default_payment_terms_days: 30,
  }, { onConflict: "organization_id" });

  // 6. Abonnement Essentiel + modules (même payload que upsertTrialForPlan / upsertModulesForPlan)
  const { data: existingSub } = await admin.from("organization_subscriptions" as any).select("id").eq("organization_id", orgId).maybeSingle();
  if (!existingSub) {
    const { data: plan } = await admin.from("subscription_plans" as any).select("id").eq("code", "essentiel").maybeSingle();
    const trialStart = new Date();
    const trialEnd = getDefaultTrialEndDate();
    const { error } = await admin.from("organization_subscriptions" as any).insert({
      organization_id: orgId,
      plan_id: plan?.id ?? null,
      plan_code: "essentiel",
      status: "trialing",
      billing_cycle: "monthly",
      billing_interval: "monthly",
      trial_started_at: trialStart.toISOString(),
      trial_start: trialStart.toISOString(),
      trial_end: trialEnd.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      trial_consent_accepted: true,
      trial_consent_accepted_at: trialStart.toISOString(),
      current_period_start: trialStart.toISOString(),
      current_period_end: trialEnd.toISOString(),
      cancel_at_period_end: false,
      monthly_amount: 290,
      yearly_amount: 2900,
      created_at: trialStart.toISOString(),
    });
    if (error) throw new Error(`subscription insert: ${error.message}`);
    put("[trial] essai Essentiel créé");
  }
  const { data: catalog } = await admin.from("modules_catalog" as any).select("module_key");
  const valid = new Set((catalog ?? []).map((r: any) => r.module_key));
  const rows = getModulesForPlan("essentiel").filter((k) => valid.has(k)).map((moduleKey) => ({
    organization_id: orgId, module_key: moduleKey, enabled: true, created_at: new Date().toISOString(),
  }));
  if (rows.length) {
    const { error } = await admin.from("organization_modules" as any).upsert(rows, { onConflict: "organization_id,module_key" });
    if (error) throw new Error(`modules upsert: ${error.message}`);
  }
  put("[trial] modules Essentiel activés");

  // 7. Référentiel : introspection des colonnes depuis un tenant existant
  const introspect = async (table: string): Promise<string[]> => {
    const { data } = await admin.from(table as any).select("*").limit(1);
    return Object.keys(data?.[0] ?? {});
  };
  const prodCols = await introspect("products");
  const unitCols = await introspect("units");
  const whCols = await introspect("warehouses");
  const tpCols = await introspect("third_parties");

  // Unités
  for (const [name, symbol] of [["Unité", "U"], ["Carton", "CTN"], ["Kilogramme", "KG"], ["Heure", "H"]] as const) {
    const { data: existing } = await admin.from("units" as any).select("id").eq("organization_id", orgId).eq("symbol", symbol).maybeSingle();
    if (!existing) {
      const payload: any = { organization_id: orgId, name, symbol };
      const { error } = await admin.from("units" as any).insert(payload);
      if (error) throw new Error(`unit ${symbol}: ${error.message}`);
    }
  }
  const { data: units } = await admin.from("units" as any).select("id,symbol").eq("organization_id", orgId);
  const unitId = (symbol: string) => units?.find((u) => u.symbol === symbol)?.id;

  // Entrepôts
  const whIds: Record<string, string> = {};
  for (const [name, code] of [["Entrepôt Marrakech", "WH-MAR"], ["Entrepôt Casablanca", "WH-CAS"]] as const) {
    const { data: existing } = await admin.from("warehouses" as any).select("id").eq("organization_id", orgId).eq("code", code).maybeSingle();
    if (existing) { whIds[code] = existing.id; continue; }
    const { data, error } = await admin.from("warehouses" as any).insert({ organization_id: orgId, name, code, status: "active" }).select("id").single();
    if (error) throw new Error(`warehouse ${code}: ${error.message}`);
    whIds[code] = data.id;
  }

  // Trésorerie (2 banques + 2 caisses)
  const accIds: Record<string, string> = {};
  const ACCOUNTS = [
    { key: "bank-marrakech", name: "Banque Marrakech", account_type: "bank", bank_name: "BMCE", opening_balance: 50000 },
    { key: "bank-casablanca", name: "Banque Casablanca", account_type: "bank", bank_name: "CIH", opening_balance: 30000 },
    { key: "cash-marrakech", name: "Caisse Marrakech", account_type: "cash", opening_balance: 5000 },
    { key: "cash-casablanca", name: "Caisse Casablanca", account_type: "cash", opening_balance: 3000 },
  ];
  for (const a of ACCOUNTS) {
    const { data: existing } = await admin.from("treasury_accounts" as any).select("id").eq("organization_id", orgId).eq("name", a.name).maybeSingle();
    if (existing) { accIds[a.key] = existing.id; continue; }
    const { data, error } = await admin.from("treasury_accounts" as any).insert({
      organization_id: orgId, name: a.name, account_type: a.account_type, bank_name: a.bank_name ?? null,
      currency: "MAD", opening_balance: a.opening_balance, current_balance: a.opening_balance, status: "active",
    }).select("id").single();
    if (error) throw new Error(`treasury ${a.key}: ${error.message}`);
    accIds[a.key] = data.id;
  }

  // Tiers : 2 clients + 2 fournisseurs (noms préfixés STRESS-)
  const tpIds: Record<string, string> = {};
  const TPS = [
    { key: "customer-1", type: "customer", name: "STRESS-Client-Retail-Casablanca", city: "Casablanca", email: "stress-c1@example.test", phone: "0661000001" },
    { key: "customer-2", type: "customer", name: "STRESS-Client-Wholesale-Marrakech", city: "Marrakech", email: "stress-c2@example.test", phone: "0661000002" },
    { key: "supplier-1", type: "supplier", name: "STRESS-Fournisseur-Import-Safi", city: "Safi", email: "stress-s1@example.test", phone: "0661000003" },
    { key: "supplier-2", type: "supplier", name: "STRESS-Fournisseur-Local-Casablanca", city: "Casablanca", email: "stress-s2@example.test", phone: "0661000004" },
  ];
  for (const t of TPS) {
    const { data: existing } = await admin.from("third_parties" as any).select("id").eq("organization_id", orgId).eq("name", t.name).maybeSingle();
    if (existing) { tpIds[t.key] = existing.id; continue; }
    const payload: any = { organization_id: orgId, type: t.type, name: t.name, city: t.city, email: t.email, phone: t.phone, primary_type: t.type, types: [t.type], status: "active", country: "MA" };
    const { data, error } = await admin.from("third_parties" as any).insert(payload).select("id").single();
    if (error) throw new Error(`tier ${t.key}: ${error.message}`);
    tpIds[t.key] = data.id;
  }

  // Taxe système 20 %
  const { data: vat20 } = await admin.from("tax_rates" as any).select("id").eq("code", "VAT_20").eq("is_system", true).maybeSingle();

  // Produits : 3 stockables + 1 service
  const prodIds: Record<string, string> = {};
  const PRODUCTS = [
    { key: "p1", type: "product", sku: "STRESS-P1", name: "STRESS-Produit A stockable", purchase_price_ht: 100, sale_price_ht: 500, track_stock: true, min_stock: 5 },
    { key: "p2", type: "product", sku: "STRESS-P2", name: "STRESS-Produit B stockable", purchase_price_ht: 250, sale_price_ht: 900, track_stock: true, min_stock: 3 },
    { key: "p3", type: "product", sku: "STRESS-P3", name: "STRESS-Produit C stockable", purchase_price_ht: 50, sale_price_ht: 120, track_stock: true, min_stock: 10 },
    { key: "s1", type: "service", sku: "STRESS-S1", name: "STRESS-Prestation installation", purchase_price_ht: 0, sale_price_ht: 300, track_stock: false, min_stock: 0 },
  ];
  for (const p of PRODUCTS) {
    const { data: existing } = await admin.from("products" as any).select("id").eq("organization_id", orgId).eq("sku", p.sku).maybeSingle();
    if (existing) { prodIds[p.key] = existing.id; continue; }
    const payload: any = {
      organization_id: orgId, type: p.type, sku: p.sku, name: p.name,
      purchase_price_ht: p.purchase_price_ht, sale_price_ht: p.sale_price_ht,
      tax_rate_id: vat20?.id ?? null, track_stock: p.track_stock, min_stock: p.min_stock,
      current_stock: 0, status: "active",
    };
    const { data, error } = await admin.from("products" as any).insert(payload).select("id").single();
    if (error) throw new Error(`produit ${p.sku}: ${error.message}`);
    prodIds[p.key] = data.id;
    if (p.track_stock) {
      for (const wh of [whIds["WH-MAR"], whIds["WH-CAS"]]) {
        await admin.from("stock_levels" as any).insert({ organization_id: orgId, warehouse_id: wh, product_id: data.id, quantity: 0 });
      }
    }
  }

  // 8. Preuve + manifest
  proof.push(`org_id=${orgId}`);
  proof.push(`password=${PASSWORD}`);
  for (const u of USERS) proof.push(`user ${u.key}=${emailOf(u.key)} (${u.fullName}, rôle ${u.role}, status ${u.membershipStatus})`);
  for (const [k, v] of Object.entries(roleIds)) proof.push(`role ${k}=${v}`);
  for (const [k, v] of Object.entries(accIds)) proof.push(`compte ${k}=${v}`);
  for (const [k, v] of Object.entries(whIds)) proof.push(`entrepot ${k}=${v}`);
  for (const [k, v] of Object.entries(tpIds)) proof.push(`tiers ${k}=${v}`);
  for (const [k, v] of Object.entries(prodIds)) proof.push(`produit ${k}=${v}`);
  proof.push(`taxe_vat20=${vat20?.id ?? "?"}`);

  const file = `03_campaign_tenant_${ts.replace(/[:.]/g, "-")}.txt`;
  fs.writeFileSync(path.join(OUT_DIR, file), proof.join("\n"), "utf8");
  put(`\nSeed terminé. Preuve → database-checks/${file}`);
})().catch((e) => { console.error("ERREUR:", e); process.exit(1); });
