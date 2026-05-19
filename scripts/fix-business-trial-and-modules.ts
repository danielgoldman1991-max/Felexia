import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BUSINESS_MODULE_KEYS } from "../src/lib/business-modules";

const BUSINESS_MODULES = [...BUSINESS_MODULE_KEYS];

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function activateTrialIfNeeded(organizationId: string) {
  const { data: existing } = await supabase
    .from("organization_subscriptions")
    .select("id, status, plan_code")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (existing?.status === "active") {
    return "already_active";
  }

  if ((existing?.status === "trialing" || existing?.status === "trial") && existing.plan_code === "business") {
    return "already_active";
  }

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id")
    .eq("code", "business")
    .maybeSingle();

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const payload = {
    organization_id: organizationId,
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
    selected_modules: BUSINESS_MODULES,
    updated_at: now.toISOString(),
  };

  const query = existing?.id
    ? supabase.from("organization_subscriptions").update(payload).eq("id", existing.id)
    : supabase.from("organization_subscriptions").insert({ ...payload, created_at: now.toISOString() });

  const { error } = await query;
  if (error) throw error;
  return existing ? "updated" : "created";
}

async function enableBusinessModules(organizationId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("organization_modules")
    .upsert(
      BUSINESS_MODULES.map((moduleKey) => ({
        organization_id: organizationId,
        module_key: moduleKey,
        enabled: true,
        created_at: now,
      })),
      { onConflict: "organization_id,module_key" },
    );

  if (error) throw error;
}

async function main() {
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (error) throw error;

  let trialsCreated = 0;
  let trialsUpdated = 0;
  let trialsKept = 0;
  let modulesEnabled = 0;

  for (const organization of organizations ?? []) {
    const result = await activateTrialIfNeeded(organization.id);
    await enableBusinessModules(organization.id);
    await supabase
      .from("organizations")
      .update({
        onboarding_step: "completed",
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organization.id);

    if (result === "created") trialsCreated += 1;
    if (result === "updated") trialsUpdated += 1;
    if (result === "already_active") trialsKept += 1;
    modulesEnabled += BUSINESS_MODULES.length;

    console.log(`${organization.name}: trial=${result}, modules=${BUSINESS_MODULES.length}`);
  }

  console.log("Résumé");
  console.log(`- Trials créés : ${trialsCreated}`);
  console.log(`- Trials mis à jour : ${trialsUpdated}`);
  console.log(`- Abonnements actifs conservés : ${trialsKept}`);
  console.log(`- Activations modules vérifiées : ${modulesEnabled}`);
}

main().catch((error) => {
  console.error("Erreur rattrapage Business trial/modules:", error);
  process.exit(1);
});
