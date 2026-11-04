import { NextResponse } from "next/server";
import { requireHrWorkspace } from "@/lib/hr/access";
import { buildEtat9421 } from "@/lib/hr/etat-9421";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const workspace = await requireHrWorkspace();
  const year = Number(new URL(request.url).searchParams.get("year") ?? new Date().getFullYear());
  const supabase = await createClient();
  const { data: periods } = await supabase.from("hr_payroll_periods").select("id").eq("organization_id", workspace.organization.id).eq("year", year);
  const periodIds = (periods ?? []).map((period) => period.id as string);
  const { data: slips } = periodIds.length
    ? await supabase.from("hr_payslips").select("employee_id, taxable_gross, ir_amount, calculation_details").in("payroll_period_id", periodIds)
    : { data: [] };
  const ids = [...new Set((slips ?? []).map((slip) => slip.employee_id as string))];
  const { data: employees } = ids.length
    ? await supabase.from("hr_employees").select("id, employee_number, full_name, cin").in("id", ids)
    : { data: [] };
  const people = new Map((employees ?? []).map((employee) => [employee.id as string, employee]));
  const grouped = new Map<string, { taxable: number; ir: number; dependents: number }>();
  for (const slip of slips ?? []) {
    const current = grouped.get(slip.employee_id as string) ?? { taxable: 0, ir: 0, dependents: 0 };
    const details = slip.calculation_details as { slip?: { familyReduction?: number } } | null;
    current.taxable += Number(slip.taxable_gross ?? 0);
    current.ir += Number(slip.ir_amount ?? 0);
    current.dependents = Math.max(current.dependents, Number(details?.slip?.familyReduction ? 1 : 0));
    grouped.set(slip.employee_id as string, current);
  }
  const body = buildEtat9421(year, [...grouped.entries()].map(([id, totals]) => {
    const employee = people.get(id);
    return {
      employeeNumber: (employee?.employee_number as string | null) ?? id,
      fullName: (employee?.full_name as string | null) ?? "",
      cin: (employee?.cin as string | null) ?? "",
      taxable: Math.round(totals.taxable * 100) / 100,
      irWithheld: Math.round(totals.ir * 100) / 100,
      dependents: totals.dependents,
    };
  }));
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="etat-9421-preparatoire-${year}.csv"`,
    },
  });
}
