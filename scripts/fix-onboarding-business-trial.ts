/**
 * Fix onboarding and business trial for existing organizations.
 *
 * Usage: npx tsx scripts/fix-onboarding-business-trial.ts
 * (requires SUPABASE_SERVICE_ROLE_KEY in .env.local or Vercel env)
 *
 * This script is idempotent:
 * - Marks onboarding as completed for orgs stuck in old flow
 * - Creates Business trial for orgs without any subscription
 * - Does NOT override existing active/paid subscriptions
 * - Does NOT create duplicates
 */

import { createClient } from "@supabase/supabase-js";
import { getBusinessTrialEndDate } from "../src/lib/subscriptions/trial-config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local or Vercel.",
  );
  process.exit(1);
}

const svc = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("🔍 Fetching organizations with onboarding issues...");

  // 1. Fix onboarding_step for orgs stuck in old flow
  const { data: stuckOrgs, error: stuckErr } = await svc
    .from("organizations")
    .select("id, name, onboarding_step, onboarding_completed")
    .in("onboarding_step", ["subscription_choice", "getting_started"])
    .eq("onboarding_completed", false);

  if (stuckErr) {
    console.error("Error fetching stuck orgs:", stuckErr.message);
  } else if (stuckOrgs && stuckOrgs.length > 0) {
    console.log(`📋 Found ${stuckOrgs.length} orgs with old onboarding steps. Fixing...`);
    for (const org of stuckOrgs) {
      await svc
        .from("organizations")
        .update({
          onboarding_step: "completed",
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", org.id);
      console.log(`  ✅ ${org.name} (${org.id}) → onboarding completed`);
    }
  } else {
    console.log("  No orgs with old onboarding steps.");
  }

  // 2. Fix onboarding_completed = null / false with valid subscriptions
  const { data: incompleteOrgs } = await svc
    .from("organizations")
    .select("id, name")
    .eq("onboarding_completed", false);

  if (incompleteOrgs && incompleteOrgs.length > 0) {
    console.log(`📋 Found ${incompleteOrgs.length} orgs with incomplete onboarding. Checking subscriptions...`);
    for (const org of incompleteOrgs) {
      const { data: sub } = await svc
        .from("organization_subscriptions")
        .select("id, status")
        .eq("organization_id", org.id)
        .in("status", ["trialing", "active"])
        .maybeSingle();

      if (sub) {
        await svc
          .from("organizations")
          .update({
            onboarding_step: "completed",
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", org.id);
        console.log(`  ✅ ${org.name} (${org.id}) → onboarding completed (has ${sub.status} subscription)`);
      }
    }
  } else {
    console.log("  No orgs with incomplete onboarding.");
  }

  // 3. Create Business trial for orgs without ANY subscription
  const { data: noSubOrgs, error: noSubErr } = await svc
    .from("organizations")
    .select("id, name")
    .not("id", "in", `(select organization_id from organization_subscriptions)`);

  if (noSubErr) {
    console.error("Error fetching orgs without subscriptions:", noSubErr.message);
  } else if (noSubOrgs && noSubOrgs.length > 0) {
    console.log(`📋 Found ${noSubOrgs.length} orgs without any subscription. Creating Business trials...`);

    const { data: businessPlan } = await svc
      .from("subscription_plans")
      .select("id")
      .eq("code", "business")
      .maybeSingle();

    if (!businessPlan) {
      console.error("❌ Business plan not found in subscription_plans table.");
      process.exit(1);
    }

    const trialStart = new Date();
    const trialEnd = getBusinessTrialEndDate(trialStart);

    for (const org of noSubOrgs) {
      const { error: insertErr } = await svc
        .from("organization_subscriptions")
        .upsert({
          organization_id: org.id,
          plan_id: businessPlan.id,
          plan_code: "business",
          status: "trialing",
          billing_cycle: "monthly",
          billing_interval: "monthly",
          trial_started_at: trialStart.toISOString(),
          trial_start: trialStart.toISOString(),
          trial_end: trialEnd.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
          trial_consent_accepted: true,
          trial_consent_accepted_at: new Date().toISOString(),
          current_period_start: trialStart.toISOString(),
          current_period_end: trialEnd.toISOString(),
          cancel_at_period_end: false,
          monthly_amount: 690,
          yearly_amount: 6900,
          selected_modules: JSON.stringify(["quotes", "invoicing", "documents", "crm", "purchases", "stock", "treasury", "accounting"]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id", ignoreDuplicates: true });

      if (insertErr) {
        console.error(`  ❌ ${org.name} (${org.id}): ${insertErr.message}`);
      } else {
        await svc
          .from("organizations")
          .update({
            onboarding_step: "completed",
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", org.id);
        console.log(`  ✅ ${org.name} (${org.id}) → Business launch trial activated (3 months)`);
      }
    }
  } else {
    console.log("  No orgs without subscriptions.");
  }

  console.log("✨ Done.");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
