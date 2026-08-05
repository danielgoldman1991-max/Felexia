// Sync the corrected Essentiel module list to existing Essentiel organizations.
// Usage:
//   Dry-run (default):        npm run sync:essentiel-modules
//   Apply:                    $env:APPLY_SYNC="true"; npm run sync:essentiel-modules
//   Apply, one org:           $env:APPLY_SYNC="true"; $env:ORG_NAME="CASSADO"; npm run sync:essentiel-modules
//   Strict mode (disable modules not in Essentiel):  $env:STRICT_MODULES="true"; npm run sync:essentiel-modules

import { createClient } from "@supabase/supabase-js";
import { ESSENTIEL_MODULE_KEYS } from "../src/lib/subscriptions/plan-modules";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TARGET_ORG_NAME = process.env.ORG_NAME;
const APPLY_SYNC = process.env.APPLY_SYNC === "true";
const STRICT_MODULES = process.env.STRICT_MODULES === "true";

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const desiredKeys: string[] = [...ESSENTIEL_MODULE_KEYS];
  console.log(`Essentiel modules cibles (${desiredKeys.length}): ${desiredKeys.join(", ")}`);
  console.log(`Mode: ${APPLY_SYNC ? "APPLICATION (APPLY_SYNC=true)" : "DRY-RUN (aucune écriture)"}`);
  if (STRICT_MODULES) console.log("Mode strict: les modules hors Essentiel seront desactives.");
  if (TARGET_ORG_NAME) console.log(`Organisation cible: ${TARGET_ORG_NAME}`);

  // Organisations dont l'abonnement est essentiel et utilisable (trialing/active/past_due)
  let orgQuery = supabase
    .from("organization_subscriptions")
    .select("organization_id, plan_code, status, organizations!inner(name)")
    .eq("plan_code", "essentiel")
    .in("status", ["trialing", "active", "past_due"]);

  if (TARGET_ORG_NAME) {
    orgQuery = orgQuery.eq("organizations.name", TARGET_ORG_NAME);
  }

  const { data: subs, error: subError } = await orgQuery;
  if (subError) {
    console.error("Echec de la requete abonnements:", subError.message);
    process.exit(1);
  }

  const rows = subs ?? [];
  const orgNames = new Map<string, string>();
  for (const s of rows) {
    const orgData = Array.isArray(s.organizations) ? s.organizations[0] : s.organizations;
    orgNames.set(s.organization_id as string, orgData?.name ?? s.organization_id as string);
  }

  const orgIds = Array.from(orgNames.keys());
  console.log(`\n${orgIds.length} organisation(s) Essentiel trouvee(s).`);

  if (orgIds.length === 0) {
    console.log("Aucune organisation a traiter.");
    return;
  }

  let updatedCount = 0;
  let completeCount = 0;

  for (const orgId of orgIds) {
    const name = orgNames.get(orgId)!;
    const { data: existingModules } = await supabase
      .from("organization_modules")
      .select("module_key, enabled")
      .eq("organization_id", orgId);

    const existing = new Map((existingModules ?? []).map((m) => [m.module_key as string, m.enabled as boolean]));

    const toEnable = desiredKeys.filter((k) => existing.get(k) !== true);
    let toDisable: string[] = [];
    if (STRICT_MODULES) {
      toDisable = Array.from(existing.keys()).filter((k) => !desiredKeys.includes(k) && existing.get(k) === true);
    }

    if (toEnable.length === 0 && toDisable.length === 0) {
      completeCount++;
      console.log(`  = ${name}: deja a jour`);
      continue;
    }

    console.log(`  ${APPLY_SYNC ? "->" : "-> (dry-run)"} ${name}: a activer [${toEnable.join(", ") || "-"}]${toDisable.length ? `, a desactiver [${toDisable.join(", ")}]` : ""}`);

    if (!APPLY_SYNC) continue;

    const now = new Date().toISOString();
    const enableRows = toEnable.map((module_key) => ({
      organization_id: orgId,
      module_key,
      enabled: true,
      created_at: now,
    }));

    if (enableRows.length > 0) {
      const { error } = await supabase
        .from("organization_modules")
        .upsert(enableRows, { onConflict: "organization_id,module_key" });
      if (error) {
        console.error(`    ERREUR activation: ${error.message}`);
        continue;
      }
    }

    if (toDisable.length > 0) {
      const { error } = await supabase
        .from("organization_modules")
        .update({ enabled: false })
        .eq("organization_id", orgId)
        .in("module_key", toDisable);
      if (error) {
        console.error(`    ERREUR desactivation: ${error.message}`);
        continue;
      }
    }

    console.log(`    OK: ${toEnable.length} module(s) active(s)${toDisable.length ? `, ${toDisable.length} desactive(s)` : ""}`);
    updatedCount++;
  }

  console.log(
    `\nTermine. ${updatedCount} organisation(s) mises a jour, ${completeCount} deja a jour.` +
    (APPLY_SYNC ? "" : "\nRe-lancez avec $env:APPLY_SYNC='true' pour appliquer."),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
