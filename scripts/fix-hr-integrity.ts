import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const applyFix = process.env.APPLY_FIX === "true";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Mode : ${applyFix ? "APPLY_FIX=true" : "rapport uniquement"}`);

  const [{ data: employeesWithoutNumber }, { data: activeWithoutContract }, { data: invalidLeaves }, { data: expiredDocuments }, { data: openAdvances }] = await Promise.all([
    supabase.from("hr_employees").select("id, organization_id, full_name").or("employee_number.is.null,employee_number.eq."),
    supabase
      .from("hr_employees")
      .select("id, organization_id, full_name")
      .in("employment_status", ["active", "trial_period"])
      .not("id", "in", "(select employee_id from hr_contracts where status = 'active')"),
    supabase.from("hr_leave_requests").select("id, organization_id, days_count").lte("days_count", 0),
    supabase.from("hr_documents").select("id, organization_id, title, expires_at").lt("expires_at", new Date().toISOString().slice(0, 10)).eq("status", "active"),
    supabase.from("hr_advances").select("id, organization_id, advance_number, status").eq("status", "paid"),
  ]);

  console.log(`Employés sans matricule : ${employeesWithoutNumber?.length ?? 0}`);
  console.log(`Employés actifs sans contrat actif : ${activeWithoutContract?.length ?? 0}`);
  console.log(`Congés avec jours <= 0 : ${invalidLeaves?.length ?? 0}`);
  console.log(`Documents RH expirés : ${expiredDocuments?.length ?? 0}`);
  console.log(`Avances payées non déduites : ${openAdvances?.length ?? 0}`);

  if (!applyFix) return;

  if (expiredDocuments?.length) {
    const ids = expiredDocuments.map((row) => row.id);
    const { error } = await supabase.from("hr_documents").update({ status: "expired" }).in("id", ids);
    if (error) throw error;
    console.log(`Documents expirés marqués : ${ids.length}`);
  }
}

main().catch((error) => {
  console.error("Erreur contrôle intégrité RH:", error);
  process.exit(1);
});
