import "server-only";
import { requireHrWorkspace } from "@/lib/hr/access";
import { createClient } from "@/lib/supabase/server";

export async function getHrPayrollPeriod(id: string) {
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.from("hr_payroll_periods").select("id,period_number,status,updated_at,employees_count,total_gross,total_net").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (error) throw new Error("La période de paie n’a pas pu être chargée.");
  return data;
}
