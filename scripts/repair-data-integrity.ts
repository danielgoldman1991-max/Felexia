import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_SCOPES = new Set([
  "payments",
  "treasury",
  "accounting",
  "document_headers",
]);

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
    if (!process.env[key]) process.env[key] = value;
  }
}

function argumentValue(name: string) {
  const prefix = `--${name}=`;
  return (
    process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() ||
    null
  );
}

function opaque(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

async function main() {
  loadLocalEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let organizationId = argumentValue("organization-id");
  const organizationSlug = argumentValue("organization-slug");
  if (!organizationId && organizationSlug) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", organizationSlug)
      .limit(2);
    if (error) throw new Error(error.message);
    if (data.length !== 1) {
      throw new Error(
        `Le filtre d'organisation doit correspondre à une seule organisation (résultats : ${data.length}).`,
      );
    }
    organizationId = String(data[0].id);
  }
  if (!organizationId) {
    throw new Error(
      "Utilisez --organization-id=<uuid> ou --organization-slug=<slug>. Une réparation globale est interdite.",
    );
  }

  const scopes = (argumentValue("scopes") ?? "payments,treasury,accounting")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const invalidScopes = scopes.filter((scope) => !ALLOWED_SCOPES.has(scope));
  if (invalidScopes.length > 0) {
    throw new Error(`Scopes non autorisés : ${invalidScopes.join(", ")}.`);
  }

  const apply = process.argv.includes("--apply");
  if (apply && argumentValue("confirm") !== "APPLY_REPAIRS") {
    throw new Error(
      "Le mode écriture exige --apply --confirm=APPLY_REPAIRS après revue du dry-run.",
    );
  }
  if (apply && scopes.includes("document_headers")) {
    throw new Error(
      "Le scope document_headers doit être lancé séparément après preuve que les lignes sont la source correcte. Retirez-le de cette exécution.",
    );
  }

  const { data, error } = await supabase.rpc("repair_erp_integrity", {
    p_organization_id: organizationId,
    p_dry_run: !apply,
    p_scopes: scopes,
  });
  if (error) {
    throw new Error(
      `La fonction transactionnelle repair_erp_integrity est indisponible ou a échoué : ${error.message}`,
    );
  }

  const result = data as Record<string, unknown> | null;
  const runId = typeof result?.run_id === "string" ? result.run_id : "unknown";
  console.log(
    JSON.stringify(
      {
        mode: apply ? "APPLY" : "DRY_RUN",
        scope: "SINGLE_ORGANIZATION",
        organization: opaque(organizationId),
        repairRun: opaque(runId),
        status: result?.status ?? "unknown",
        summary: result?.summary ?? null,
        transaction: "Une erreur annule toutes les mutations du run avant journalisation de l'échec.",
      },
      null,
      2,
    ),
  );
  if (result?.status === "failed") process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    "Réparation d'intégrité interrompue :",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
