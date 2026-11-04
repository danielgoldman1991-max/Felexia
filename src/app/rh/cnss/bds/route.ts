import { NextResponse } from "next/server";
import { requireHrWorkspace } from "@/lib/hr/access";
import { buildPreparatoryBds } from "@/lib/hr/bds";
import { bdsIssues, controlTrailer } from "@/lib/accounting/fiscal-files";
import { MA_PAYROLL_2026 } from "@/lib/hr/ma-payroll-2026";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const workspace = await requireHrWorkspace();
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  const month = Number(url.searchParams.get("month") ?? new Date().getMonth() + 1);
  const supabase = await createClient();
  const { data: period } = await supabase.from("hr_payroll_periods").select("id").eq("organization_id", workspace.organization.id).eq("year", year).eq("month", month).maybeSingle();
  const { data: slips } = period
    ? await supabase.from("hr_payslips").select("employee_id, gross_salary").eq("organization_id", workspace.organization.id).eq("payroll_period_id", period.id)
    : { data: [] };
  const ids = (slips ?? []).map((slip) => slip.employee_id as string);
  const { data: people } = ids.length
    ? await supabase.from("hr_employees").select("id, first_name, last_name, cnss_number").in("id", ids)
    : { data: [] };
  const names = new Map((people ?? []).map((employee) => [employee.id as string, employee]));
  const rows = (slips ?? []).map((slip) => {
    const employee = names.get(slip.employee_id as string);
    const gross = Number(slip.gross_salary ?? 0);
    return {
      cnssNumber: (employee?.cnss_number as string | null) ?? "",
      lastName: (employee?.last_name as string | null) ?? "",
      firstName: (employee?.first_name as string | null) ?? "",
      days: 26,
      gross,
      capped: Math.min(gross, MA_PAYROLL_2026.cnssMonthlyCeiling),
    };
  });
  const body = `${buildPreparatoryBds(`${year}${String(month).padStart(2, "0")}`, rows)}${controlTrailer(bdsIssues(rows, MA_PAYROLL_2026.cnssMonthlyCeiling))}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="bds-preparatoire-${year}-${month}.txt"`,
    },
  });
}
