"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { isMissingSchema } from "@/lib/optional-schema";
import { calculateMoroccanPayslip2026 } from "@/lib/hr/ma-payroll-2026";
import { payrollReference2026Settings } from "@/lib/hr/payroll-reference";
import { postPayrollAccrualEntry, postPayrollPaymentEntry } from "@/lib/hr/payroll-posting";
import { createClient } from "@/lib/supabase/server";

function monthEnd(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export async function applyPayrollReference2026Action(): Promise<{ success: boolean; error?: string }> {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();
  const saved = await supabase.from("hr_settings").upsert(payrollReference2026Settings(workspace.organization.id), { onConflict: "organization_id" });
  if (saved.error) return { success: false, error: saved.error.message };
  revalidatePath("/rh/paie");
  revalidatePath("/rh/parametres");
  return { success: true };
}

export async function prepareReferencePayrollAction(periodId: string, _previous: { error?: string; success?: boolean }, formData: FormData) {
  void _previous;
  try {
    const workspace = await requireWritableHrWorkspace();
    const { assertModulePermission } = await import("@/lib/auth/module-permission");
    await assertModulePermission(workspace, "paie", "write");
    if (formData.get("ack_base_only") !== "yes") {
      return { success: false, error: "Confirmez l'utilisation du référentiel 2026 avant de calculer les bulletins." };
    }
    const supabase = await createClient();
    const settings = await supabase.from("hr_settings").upsert(payrollReference2026Settings(workspace.organization.id), { onConflict: "organization_id" });
    if (settings.error && !isMissingSchema(settings.error)) return { success: false, error: settings.error.message };
    const { data: period, error: periodError } = await supabase
      .from("hr_payroll_periods")
      .select("id, year, month, status")
      .eq("organization_id", workspace.organization.id)
      .eq("id", periodId)
      .maybeSingle();
    if (periodError || !period) return { success: false, error: "Période de paie introuvable." };
    if (!["draft", "calculated"].includes(period.status)) return { success: false, error: "Cette période est figée." };
    const { data: employees, error: employeeError } = await supabase
      .from("hr_employees")
      .select("id, employee_number, first_name, last_name, base_salary, hire_date, dependents_count, employment_status")
      .eq("organization_id", workspace.organization.id)
      .is("archived_at", null)
      .neq("employment_status", "terminated");
    if (employeeError) return { success: false, error: employeeError.message };
    const { data: contracts } = await supabase.from("hr_contracts").select("employee_id, base_salary, status").eq("organization_id", workspace.organization.id).eq("status", "active");
    const contractSalary = new Map((contracts ?? []).map((row) => [row.employee_id as string, Number(row.base_salary ?? 0)]));
    const { data: existingSlips } = await supabase.from("hr_payslips").select("employee_id, payslip_number").eq("organization_id", workspace.organization.id).eq("payroll_period_id", periodId);
    const usedNumbers = new Set((existingSlips ?? []).map((row) => String(row.payslip_number ?? "")));
    const numberByEmployee = new Map((existingSlips ?? []).map((row) => [row.employee_id as string, String(row.payslip_number ?? "")]));
    const periodDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
    const periodEnd = monthEnd(period.year, period.month);
    const skipped: Array<{ name: string; reason: string }> = [];
    let totalGross = 0;
    let totalNet = 0;
    let totalCost = 0;
    let count = 0;
    for (const employee of employees ?? []) {
      const name = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || employee.employee_number || "Salarié";
      if (!["active", "trial_period", "on_leave"].includes(String(employee.employment_status))) {
        skipped.push({ name, reason: employee.employment_status === "suspended" ? "Statut suspendu : exclu de la paie du mois." : `Statut « ${employee.employment_status} » : exclu de la paie.` });
        continue;
      }
      if (employee.hire_date && String(employee.hire_date) > periodEnd) {
        skipped.push({ name, reason: `Date d'entrée ${employee.hire_date} postérieure à la période.` });
        continue;
      }
      const salary = Number(employee.base_salary ?? 0) > 0 ? Number(employee.base_salary) : Number(contractSalary.get(employee.id) ?? 0);
      if (!(salary > 0)) {
        skipped.push({ name, reason: "Salaire de base absent sur la fiche et sur le contrat actif." });
        continue;
      }
      const scheduled = await scheduledDeductions(supabase, workspace.organization.id, employee.id, period.year, period.month);
      const slip = calculateMoroccanPayslip2026({
        baseSalary: salary,
        hireDate: employee.hire_date,
        periodDate,
        dependents: Number(employee.dependents_count ?? 0),
        advanceDeduction: scheduled.advances + scheduled.loans,
      });
      const currentNumber = numberByEmployee.get(employee.id);
      const payslipNumber = currentNumber && /^BUL-\d{4}-\d{2}-\d{4}$/.test(currentNumber) ? currentNumber : nextBulletinNumber(period.year, period.month, usedNumbers);
      const saved = await supabase.from("hr_payslips").upsert({
        organization_id: workspace.organization.id,
        payroll_period_id: periodId,
        employee_id: employee.id,
        payslip_number: payslipNumber,
        base_salary: slip.baseSalary,
        gross_salary: slip.gross,
        taxable_gross: slip.taxableMonthly,
        net_salary: slip.net,
        net_to_pay: slip.netToPay,
        employer_cost: slip.employerCost,
        cnss_employee: slip.cnssEmployee,
        amo_employee: slip.amoEmployee,
        ir_amount: slip.ir,
        advance_deduction: scheduled.advances + scheduled.loans,
        cnss_employer: Math.round((slip.cnssEmployerSocial + slip.cnssEmployerFamily) * 100) / 100,
        amo_employer: slip.amoEmployer,
        earnings: [
          { code: "BASE", label: "Salaire de base", amount: slip.baseSalary },
          { code: "ANCIENNETE", label: `Prime d'ancienneté ${slip.seniorityPercent} %`, amount: slip.seniorityBonus },
        ],
        deductions: [
          { code: "CNSS", label: "CNSS salarié", amount: slip.cnssEmployee },
          { code: "AMO", label: "AMO salarié", amount: slip.amoEmployee },
          { code: "IR", label: "IR", amount: slip.ir },
          { code: "AVANCE", label: "Avances et prêts", amount: scheduled.advances + scheduled.loans },
        ],
        employer_contributions: [
          { code: "CNSS_ER", label: "CNSS employeur", amount: slip.cnssEmployerSocial + slip.cnssEmployerFamily },
          { code: "AMO_ER", label: "AMO employeur", amount: slip.amoEmployer },
          { code: "FORMATION", label: "Taxe de formation professionnelle", amount: slip.trainingTax },
        ],
        calculation_details: { scope: "reference_2026", dependents: slip.dependents, advanceIds: scheduled.advanceIds, slip, officialConformityClaim: false },
        status: "calculated",
      }, { onConflict: "payroll_period_id,employee_id" });
      if (saved.error) {
        skipped.push({ name, reason: saved.error.message.includes("duplicate") || saved.error.code === "23505" ? "Numéro de bulletin déjà utilisé." : "Le bulletin n'a pas pu être enregistré." });
        continue;
      }
      count += 1;
      totalGross += slip.gross;
      totalNet += slip.netToPay;
      totalCost += slip.employerCost;
    }
    await supabase.from("hr_payroll_periods").update({
      status: "calculated",
      employees_count: count,
      total_gross: Math.round(totalGross * 100) / 100,
      total_net: Math.round(totalNet * 100) / 100,
      total_employer_cost: Math.round(totalCost * 100) / 100,
    }).eq("organization_id", workspace.organization.id).eq("id", periodId);
    await logAudit(workspace.organization.id, "payroll_calculated", "hr_payroll_periods", periodId, { employees: count, skipped: skipped.length });
    revalidatePath(`/rh/paie/periodes/${periodId}`);
    revalidatePath("/rh/paie");
    revalidatePath("/rh/paie/bulletins");
    return { success: true, count, skipped };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Le calcul n'a pas abouti." };
  }
}

export async function setPayrollPeriodStatusAction(periodId: string, next: "validated" | "paid") {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();
  const { data: period } = await supabase.from("hr_payroll_periods").select("id, year, month, status").eq("organization_id", workspace.organization.id).eq("id", periodId).maybeSingle();
  if (!period) return { success: false, error: "Période introuvable." };
  const { data: slips } = await supabase.from("hr_payslips").select("id, status, payslip_number, gross_salary, net_to_pay, employer_cost, cnss_employee, cnss_employer, amo_employee, amo_employer, ir_amount, advance_deduction, employee_id").eq("organization_id", workspace.organization.id).eq("payroll_period_id", periodId);
  const rows = slips ?? [];
  if (rows.length === 0) return { success: false, error: "Calculez d'abord les bulletins." };
  if (next === "validated") {
    const payDate = monthEnd(period.year, period.month);
    for (const slip of rows) {
      const { data: employee } = await supabase.from("hr_employees").select("first_name, last_name").eq("id", slip.employee_id).maybeSingle();
      const posted = await postPayrollAccrualEntry(workspace.organization.id, {
        id: slip.id,
        payslipNumber: slip.payslip_number,
        employeeName: `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() || "Salarié",
        gross: Number(slip.gross_salary ?? 0),
        employerCost: Number(slip.employer_cost ?? 0),
        cnssEmployee: Number(slip.cnss_employee ?? 0),
        cnssEmployer: Number(slip.cnss_employer ?? 0),
        amoEmployee: Number(slip.amo_employee ?? 0),
        amoEmployer: Number(slip.amo_employer ?? 0),
        ir: Number(slip.ir_amount ?? 0),
        advances: Number(slip.advance_deduction ?? 0),
        loans: 0,
        netToPay: Number(slip.net_to_pay ?? 0),
        date: payDate,
      });
      if (!posted.success) return { success: false, error: posted.error };
      if (slip.status === "paid" || slip.status === "validated") continue;
      const updated = await supabase.from("hr_payslips").update({ status: "validated" }).eq("organization_id", workspace.organization.id).eq("id", slip.id);
      if (updated.error) return { success: false, error: updated.error.message };
    }
    await logAudit(workspace.organization.id, "payroll_validated", "hr_payroll_periods", periodId, { slips: rows.length });
    const periodUpdate = await supabase.from("hr_payroll_periods").update({ status: "validated" }).eq("organization_id", workspace.organization.id).eq("id", periodId);
    if (periodUpdate.error) return { success: false, error: periodUpdate.error.message };
  } else {
    const payDate = monthEnd(period.year, period.month);
    for (const slip of rows) {
      if (slip.status === "draft") return { success: false, error: "Validez les bulletins avant de les payer." };
      const { data: employee } = await supabase.from("hr_employees").select("first_name, last_name").eq("id", slip.employee_id).maybeSingle();
      const posted = await postPayrollPaymentEntry(workspace.organization.id, {
        id: slip.id,
        payslipNumber: slip.payslip_number,
        employeeName: `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() || "Salarié",
        gross: Number(slip.gross_salary ?? 0),
        employerCost: Number(slip.employer_cost ?? 0),
        cnssEmployee: Number(slip.cnss_employee ?? 0),
        cnssEmployer: Number(slip.cnss_employer ?? 0),
        amoEmployee: Number(slip.amo_employee ?? 0),
        amoEmployer: Number(slip.amo_employer ?? 0),
        ir: Number(slip.ir_amount ?? 0),
        advances: Number(slip.advance_deduction ?? 0),
        loans: 0,
        netToPay: Number(slip.net_to_pay ?? 0),
        date: payDate,
      });
      if (!posted.success) return { success: false, error: posted.error };
      if (slip.status !== "paid") {
        const updated = await supabase.from("hr_payslips").update({ status: "paid", paid_at: payDate }).eq("organization_id", workspace.organization.id).eq("id", slip.id);
        if (updated.error) return { success: false, error: updated.error.message };
      }
    }
    const periodUpdate = await supabase.from("hr_payroll_periods").update({ status: "paid" }).eq("organization_id", workspace.organization.id).eq("id", periodId);
    if (periodUpdate.error) return { success: false, error: periodUpdate.error.message };
  }
  revalidatePath(`/rh/paie/periodes/${periodId}`);
  revalidatePath("/comptabilite/ecritures");
  return { success: true };
}

async function scheduledDeductions(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, employeeId: string, year: number, month: number) {
  const advances = await supabase.from("hr_advances").select("id, amount, status, deduction_month, deduction_year").eq("organization_id", organizationId).eq("employee_id", employeeId).in("status", ["approved", "paid"]);
  let advanceTotal = 0;
  const advanceIds: string[] = [];
  if (!advances.error) {
    for (const row of advances.data ?? []) {
      const matches = Number(row.deduction_year) === year && Number(row.deduction_month) === month;
      if (!matches) continue;
      advanceTotal += Number(row.amount ?? 0);
      advanceIds.push(row.id);
    }
  }
  const loans = await supabase.from("hr_loans").select("monthly_deduction, remaining_amount, start_month, start_year, status").eq("organization_id", organizationId).eq("employee_id", employeeId).eq("status", "active");
  let loanTotal = 0;
  if (!loans.error) {
    for (const row of loans.data ?? []) {
      const started = row.start_year < year || (row.start_year === year && row.start_month <= month);
      if (!started) continue;
      loanTotal += Math.min(Number(row.monthly_deduction ?? 0), Number(row.remaining_amount ?? 0));
    }
  }
  return {
    advances: Math.round(advanceTotal * 100) / 100,
    loans: Math.round(loanTotal * 100) / 100,
    advanceIds,
  };
}

function nextBulletinNumber(year: number, month: number, used: Set<string>) {
  const prefix = `BUL-${year}-${String(month).padStart(2, "0")}-`;
  let sequence = 1;
  while (used.has(`${prefix}${String(sequence).padStart(4, "0")}`)) sequence += 1;
  const number = `${prefix}${String(sequence).padStart(4, "0")}`;
  used.add(number);
  return number;
}
