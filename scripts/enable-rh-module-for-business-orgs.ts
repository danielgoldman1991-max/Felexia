// Enable Business + RH modules for existing Business/Premium organizations
// Usage: npx tsx scripts/enable-rh-module-for-business-orgs.ts

import { createClient } from "@supabase/supabase-js";
import { PREMIUM_MODULE_KEYS } from "../src/lib/subscriptions/plan-modules";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TARGET_ORG_NAME = process.env.ORG_NAME;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find orgs with Business or Premium subscriptions (active, trialing, past_due)
  let orgQuery = supabase
    .from("organization_subscriptions")
    .select("organization_id, plan_code, status, organizations!inner(name)")
    .in("plan_code", ["business", "premium"])
    .in("status", ["active", "trialing", "past_due"]);

  if (TARGET_ORG_NAME) {
    orgQuery = orgQuery.eq("organizations.name", TARGET_ORG_NAME);
  }

  const { data: subs, error: subError } = await orgQuery;
  if (subError) {
    console.error("Failed to query subscriptions:", subError.message);
    process.exit(1);
  }

  const orgIds = Array.from(new Set((subs ?? []).map((s) => s.organization_id as string)));
  console.log(`Found ${orgIds.length} organization(s) with Business/Premium subscription`);

  if (orgIds.length === 0) {
    console.log("No organizations to update.");
    return;
  }

  let enabledCount = 0;
  let skippedCount = 0;

  for (const orgId of orgIds) {
    // Check which modules already exist
    const { data: existingModules } = await supabase
      .from("organization_modules")
      .select("module_key")
      .eq("organization_id", orgId);

    const existingKeys = new Set((existingModules ?? []).map((m) => m.module_key as string));

    const missingKeys = PREMIUM_MODULE_KEYS.filter((k) => !existingKeys.has(k));

    if (missingKeys.length === 0) {
      skippedCount++;
      continue;
    }

    const now = new Date().toISOString();
    const rows = missingKeys.map((mk) => ({
      organization_id: orgId,
      module_key: mk,
      enabled: true,
      created_at: now,
    }));

    const { error } = await supabase
      .from("organization_modules")
      .upsert(rows, { onConflict: "organization_id,module_key" });

    if (error) {
      console.error(`  ❌ Org ${orgId}: ${error.message}`);
    } else {
      console.log(`  ✅ Org ${orgId}: enabled ${missingKeys.join(", ")}`);
      enabledCount++;
    }
  }

  console.log(`\nDone. ${enabledCount} org(s) updated, ${skippedCount} org(s) already complete.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
