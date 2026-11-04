"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isNextControlFlow } from "@/lib/hr/leave-balance";
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
  const workspace = await requireWritableHrWorkspace("paie");
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
    const workspace = await requireWritableHrWorkspace("paie");
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
    if (["validated", "paid", "archived"].includes(period.status)) {
      return { success: false, error: "Cette période est validée ou payée. Les bulletins déjà validés ne sont pas recalculés." };
    }
    const { data: employees, error: employeeError } = await supabase
      .from("hr_employees")
      .select("id, employee_number, first_name, last_name, base_salary, hire_date, dependents_count, employment_status, archived_at")
      .eq("organization_id", workspace.organization.id)
      .or("archived_at.is.null,employment_status.eq.terminated");
    if (employeeError) return { success: false, error: employeeError.message };
    const { data: contracts } = await supabase.from("hr_contracts").select("employee_id, base_salary, status").eq("organization_id", workspace.organization.id).eq("status", "active");
    const contractSalary = new Map((contracts ?? []).map((row) => [row.employee_id as string, Number(row.base_salary ?? 0)]));
    const { data: existingSlips } = await supabase.from("hr_payslips").select("id, employee_id, payslip_number, status, gross_salary, net_to_pay, employer_cost").eq("organization_id", workspace.organization.id).eq("payroll_period_id", periodId);
    const usedNumbers = new Set((existingSlips ?? []).map((row) => String(row.payslip_number ?? "")));
    const slipByEmployee = new Map((existingSlips ?? []).map((row) => [row.employee_id as string, row]));
    const periodDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
    const periodEnd = monthEnd(period.year, period.month);
    const skipped: Array<{ name: string; reason: string }> = [];
    const eligible: Array<{ employee: (typeof employees)[number]; name: string; salary: number; existingNumber: string }> = [];
    for (const employee of employees ?? []) {
      const person = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim() || "Salarié";
      const name = employee.employee_number ? `${employee.employee_number} · ${person}` : person;
      if (employee.employment_status === "terminated" || employee.archived_at) {
        skipped.push({ name, reason: "sorti" });
        continue;
      }
      const existing = slipByEmployee.get(employee.id);
      if (existing && ["validated", "paid"].includes(String(existing.status))) {
        skipped.push({ name, reason: "Bulletin déjà validé : non recalculé." });
        continue;
      }
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
      eligible.push({ employee, name, salary, existingNumber: existing ? String(existing.payslip_number ?? "") : "" });
    }
    const eligibleIds = eligible.map((item) => item.employee.id);
    const [advanceRows, loanRows] = eligibleIds.length === 0
      ? [{ data: [], error: null }, { data: [], error: null }]
      : await Promise.all([
        supabase.from("hr_advances").select("id, employee_id, amount, status, deduction_month, deduction_year").eq("organization_id", workspace.organization.id).in("employee_id", eligibleIds).in("status", ["approved", "paid"]),
        supabase.from("hr_loans").select("employee_id, monthly_deduction, remaining_amount, start_month, start_year, status").eq("organization_id", workspace.organization.id).in("employee_id", eligibleIds).eq("status", "active"),
      ]);
    if (advanceRows.error || loanRows.error) {
      return { success: false, error: "Les avances et prêts n'ont pas pu être lus. Aucun bulletin n'a été modifié." };
    }
    const slipsToSave = eligible.map(({ employee, salary, existingNumber }) => {
      const scheduled = deductionsForEmployee(advanceRows.data ?? [], loanRows.data ?? [], employee.id, period.year, period.month);
      const slip = calculateMoroccanPayslip2026({
        baseSalary: salary,
        hireDate: employee.hire_date,
        periodDate,
        dependents: Number(employee.dependents_count ?? 0),
        advanceDeduction: scheduled.advances + scheduled.loans,
      });
      const payslipNumber = sequentialBulletinNumber(existingNumber, period.year, period.month) ? existingNumber : nextBulletinNumber(period.year, period.month, usedNumbers);
      return {
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
      };
    });
    let count = 0;
    if (slipsToSave.length > 0) {
      const saved = await supabase.from("hr_payslips").upsert(slipsToSave, { onConflict: "payroll_period_id,employee_id" });
      if (saved.error) {
        await syncPayrollPeriodTotals(supabase, workspace.organization.id, periodId, null);
        return { success: false, error: saved.error.code === "23505" ? "Un numéro de bulletin est déjà utilisé. Aucun total n'a été remis à zéro." : "Le calcul n'a pas été enregistré. Les totaux existants sont conservés." };
      }
      count = slipsToSave.length;
    }
    const stored = await syncPayrollPeriodTotals(supabase, workspace.organization.id, periodId, period.status === "draft" && count > 0 ? "calculated" : null);
    if (!stored.ok) return { success: false, error: stored.error ?? "Les totaux de la période n'ont pas pu être recalculés.", count, skipped };
    if (count === 0 && skipped.some((item) => item.reason.startsWith("Bulletin déjà validé"))) {
      const stillOpen = (existingSlips ?? []).some((row) => !["validated", "paid", "cancelled"].includes(String(row.status)));
      if (!stillOpen && (existingSlips ?? []).length > 0 && period.status === "calculated") {
        await supabase.from("hr_payroll_periods").update({ status: "validated" }).eq("organization_id", workspace.organization.id).eq("id", periodId).eq("status", "calculated");
      }
      return { success: false, error: "Des bulletins sont déjà validés. Ils n'ont pas été recalculés et les totaux de la période ont été repris depuis les bulletins existants.", count, skipped };
    }
    await logAudit(workspace.organization.id, "payroll_calculated", "hr_payroll_periods", periodId, { employees: count, skipped: skipped.length });
    revalidatePath(`/rh/paie/periodes/${periodId}`);
    revalidatePath("/rh/paie");
    revalidatePath("/rh/paie/bulletins");
    const params = new URLSearchParams({ prepare: "1", count: String(count) });
    if (skipped.length > 0) params.set("skipped", skipped.slice(0, 20).map((item) => `${item.name} : ${item.reason}`).join(" | "));
    redirect(`/rh/paie/periodes/${periodId}?${params.toString()}`);
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "Le calcul n'a pas abouti." };
  }
}

export async function setPayrollPeriodStatusAction(periodId: string, next: "validated" | "paid") {
  const workspace = await requireWritableHrWorkspace("paie");
  const supabase = await createClient();
  const { data: period } = await supabase.from("hr_payroll_periods").select("id, year, month, status").eq("organization_id", workspace.organization.id).eq("id", periodId).maybeSingle();
  if (!period) return { success: false, error: "Période introuvable." };
  const { data: slips } = await supabase.from("hr_payslips").select("id, status, payslip_number, gross_salary, net_to_pay, employer_cost, cnss_employee, cnss_employer, amo_employee, amo_employer, ir_amount, advance_deduction, employee_id").eq("organization_id", workspace.organization.id).eq("payroll_period_id", periodId);
  const rows = slips ?? [];
  if (rows.length === 0) return { success: false, error: "Calculez d'abord les bulletins." };
  if (next === "validated") {
    const payDate = monthEnd(period.year, period.month);
    const missing: string[] = [];
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
      if (!posted.success) {
        missing.push(String(slip.payslip_number ?? slip.id));
        continue;
      }
      if (slip.status === "paid" || slip.status === "validated") continue;
      const updated = await supabase.from("hr_payslips").update({ status: "validated" }).eq("organization_id", workspace.organization.id).eq("id", slip.id);
      if (updated.error) missing.push(String(slip.payslip_number ?? slip.id));
    }
    if (missing.length > 0) {
      return { success: false, error: `Écriture de charges manquante pour ${missing.length} bulletin${missing.length > 1 ? "s" : ""} : ${missing.join(", ")}. Les autres ont une écriture.` };
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

function deductionsForEmployee(advances: Array<{ id?: string; employee_id?: string; amount?: number | null; deduction_month?: number | null; deduction_year?: number | null }>, loans: Array<{ employee_id?: string; monthly_deduction?: number | null; remaining_amount?: number | null; start_month?: number | null; start_year?: number | null }>, employeeId: string, year: number, month: number) {
  let advanceTotal = 0;
  const advanceIds: string[] = [];
  for (const row of advances) {
    if (row.employee_id !== employeeId) continue;
    if (Number(row.deduction_year) !== year || Number(row.deduction_month) !== month) continue;
    advanceTotal += Number(row.amount ?? 0);
    if (row.id) advanceIds.push(row.id);
  }
  let loanTotal = 0;
  for (const row of loans) {
    if (row.employee_id !== employeeId) continue;
    const started = Number(row.start_year) < year || (Number(row.start_year) === year && Number(row.start_month) <= month);
    if (!started) continue;
    loanTotal += Math.min(Number(row.monthly_deduction ?? 0), Number(row.remaining_amount ?? 0));
  }
  return {
    advances: Math.round(advanceTotal * 100) / 100,
    loans: Math.round(loanTotal * 100) / 100,
    advanceIds,
  };
}

async function syncPayrollPeriodTotals(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, periodId: string, nextStatus: "calculated" | null) {
  const { data, error } = await supabase.from("hr_payslips").select("gross_salary, net_to_pay, employer_cost, status").eq("organization_id", organizationId).eq("payroll_period_id", periodId);
  if (error || !data) return { ok: false, error: "Les bulletins existants n'ont pas pu être relus. Les totaux de la période n'ont pas été modifiés." };
  const rows = data.filter((row) => row.status !== "cancelled");
  if (rows.length === 0) return { ok: true };
  const patch: Record<string, number | string> = {
    employees_count: rows.length,
    total_gross: roundMoney(rows.reduce((sum, row) => sum + Number(row.gross_salary ?? 0), 0)),
    total_net: roundMoney(rows.reduce((sum, row) => sum + Number(row.net_to_pay ?? 0), 0)),
    total_employer_cost: roundMoney(rows.reduce((sum, row) => sum + Number(row.employer_cost ?? 0), 0)),
  };
  if (nextStatus) patch.status = nextStatus;
  const updated = await supabase.from("hr_payroll_periods").update(patch).eq("organization_id", organizationId).eq("id", periodId);
  if (updated.error) return { ok: false, error: "Les totaux n'ont pas été remis à zéro. " + updated.error.message };
  return { ok: true };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sequentialBulletinNumber(number: string, year: number, month: number) {
  return new RegExp(`^BUL-${year}-${String(month).padStart(2, "0")}-\\d{4}$`).test(number);
}

function nextBulletinNumber(year: number, month: number, used: Set<string>) {
  const prefix = `BUL-${year}-${String(month).padStart(2, "0")}-`;
  let sequence = 1;
  while (used.has(`${prefix}${String(sequence).padStart(4, "0")}`)) sequence += 1;
  const number = `${prefix}${String(sequence).padStart(4, "0")}`;
  used.add(number);
  return number;
}
