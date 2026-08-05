import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  BUSINESS_TRIAL_LABEL,
  DEFAULT_TRIAL_LABEL,
  getBusinessTrialEndDate,
  getDefaultTrialEndDate,
} from "../src/lib/subscriptions/trial-config";

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const applyReset = process.env.APPLY_RESET === "true";
const orgId = process.env.ORG_ID?.trim();
const orgName = process.env.ORG_NAME?.trim();
const resetPlan = (process.env.RESET_PLAN as "essentiel" | "business") ?? "essentiel";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type BusinessTrialSubscription = {
  id: string;
  organization_id: string;
  plan_code: string | null;
  status: string | null;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

async function resolveOrganizationIdsByName(name: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("name", name);

  if (error) throw error;
  return (data ?? []).map((organization) => organization.id as string);
}

async function countPaidSubscriptions(organizationIds: string[] | null): Promise<number> {
  let query = supabase
    .from("organization_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("plan_code", resetPlan)
    .eq("status", "active");

  if (organizationIds?.length) {
    query = query.in("organization_id", organizationIds);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function getCandidateTrials(organizationIds: string[] | null): Promise<BusinessTrialSubscription[]> {
  let query = supabase
    .from("organization_subscriptions")
    .select("id, organization_id, plan_code, status, trial_start, trial_end, current_period_start, current_period_end")
    .eq("plan_code", resetPlan)
    .in("status", ["trialing", "trial"])
    .order("updated_at", { ascending: false });

  if (organizationIds?.length) {
    query = query.in("organization_id", organizationIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BusinessTrialSubscription[];
}

async function main() {
  let organizationIds: string[] | null = null;

  if (orgId) {
    organizationIds = [orgId];
  } else if (orgName) {
    organizationIds = await resolveOrganizationIdsByName(orgName);
    if (organizationIds.length === 0) {
      console.log(`Aucune organisation trouvée avec ORG_NAME="${orgName}".`);
      return;
    }
  }

  const candidates = await getCandidateTrials(organizationIds);
  const paidIgnored = await countPaidSubscriptions(organizationIds);
  const now = new Date();
  const trialEnd =
    resetPlan === "business" ? getBusinessTrialEndDate(now) : getDefaultTrialEndDate(now);
  const offerLabel = resetPlan === "business" ? BUSINESS_TRIAL_LABEL : DEFAULT_TRIAL_LABEL;

  console.log(`Offre : ${offerLabel}`);
  console.log(`Plan ciblé : ${resetPlan}`);
  console.log(`Mode : ${applyReset ? "APPLY_RESET=true, mise à jour activée" : "dry-run, aucune donnée modifiée"}`);
  if (orgId) console.log(`Filtre ORG_ID : ${orgId}`);
  if (orgName) console.log(`Filtre ORG_NAME : ${orgName}`);
  console.log(`Essais ${resetPlan} trialing/trial détectés : ${candidates.length}`);
  console.log(`Abonnements ${resetPlan} payants actifs ignorés : ${paidIgnored}`);
  console.log(`Nouvelle période : ${now.toISOString()} -> ${trialEnd.toISOString()}`);

  if (!applyReset) {
    for (const subscription of candidates) {
      console.log(
        `DRY-RUN ${subscription.organization_id}: ${subscription.status}, trial_end actuel=${subscription.trial_end ?? "null"}`,
      );
    }
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const subscription of candidates) {
    const { error } = await supabase
      .from("organization_subscriptions")
      .update({
        trial_started_at: now.toISOString(),
        trial_start: now.toISOString(),
        trial_end: trialEnd.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", subscription.id)
      .eq("plan_code", resetPlan)
      .in("status", ["trialing", "trial"]);

    if (error) {
      failed += 1;
      console.error(`Erreur ${subscription.organization_id}: ${error.message}`);
    } else {
      updated += 1;
      console.log(`RESET ${subscription.organization_id}: trial_end=${trialEnd.toISOString()}`);
    }
  }

  console.log("Résumé");
  console.log(`- Organisations détectées : ${candidates.length}`);
  console.log(`- Essais réinitialisés : ${updated}`);
  console.log(`- Abonnements payants ignorés : ${paidIgnored}`);
  console.log(`- Erreurs : ${failed}`);
}

main().catch((error) => {
  console.error("Erreur reset Business trial lancement:", error);
  process.exit(1);
});
