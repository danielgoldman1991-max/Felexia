"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { createClient } from "@/lib/supabase/server";
import { parseHrSalary, validateCin, validateCnss, validateRib } from "@/lib/hr/validation";
import { proTransactionError } from "@/lib/pro-transaction-errors";
import { ensureHrReferenceData } from "@/lib/hr/reference-data";
import { isBaseOnlyPayrollAcknowledgement } from "@/lib/hr/payroll-engine";
import { calculateMoroccanPayslip2026, overtimePayFromHours } from "@/lib/hr/ma-payroll-2026";
import { leaveBalance, leaveRangesOverlap, LEAVE_OVERLAP_MESSAGE } from "@/lib/hr/leave-balance";

export async function createHrEmployeeAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const salary = parseHrSalary(formData.get("base_salary"));
  const supabase = await createClient();
  await ensureHrReferenceData(supabase, workspace.organization.id);

  const payload = {
    organization_id: workspace.organization.id,
    employee_number: requiredString(formData, "employee_number"),
    first_name: requiredString(formData, "first_name"),
    last_name: requiredString(formData, "last_name"),
    email: optionalString(formData, "email"),
    phone: optionalString(formData, "phone"),
    city: optionalString(formData, "city"),
    cin: validateCin(optionalString(formData, "cin")),
    cnss_number: validateCnss(optionalString(formData, "cnss_number")),
    rib: validateRib(optionalString(formData, "rib")),
    marital_status: optionalString(formData, "marital_status"),
    dependents_count: Math.max(0, Math.min(12, Math.round(numberValue(formData, "dependents_count")))),
    cimr_enabled: formData.get("cimr_enabled") === "on",
    cimr_rate: numberValue(formData, "cimr_rate"),
    mutuelle_label: optionalString(formData, "mutuelle_label"),
    mutuelle_amount: numberValue(formData, "mutuelle_amount"),
    weekly_hours: numberValue(formData, "weekly_hours") || 44,
    department_id: optionalString(formData, "department_id"),
    position_id: optionalString(formData, "position_id"),
    hire_date: requiredString(formData, "hire_date"),
    employment_status: optionalString(formData, "employment_status") ?? "active",
    base_salary: salary,
    created_by: workspace.userId,
  };

  let saved = await supabase.from("hr_employees").insert(payload).select("id").single();
  if (saved.error && missingColumn(saved.error)) {
    const { cimr_enabled, cimr_rate, mutuelle_label, mutuelle_amount, weekly_hours, ...base } = payload;
    void cimr_enabled; void cimr_rate; void mutuelle_label; void mutuelle_amount; void weekly_hours;
    saved = await supabase.from("hr_employees").insert(base).select("id").single();
  }
  if (saved.error || !saved.data) throw new Error(saved.error?.message ?? "Le salarié n'a pas été créé.");
  const data = saved.data;

  revalidatePath("/rh");
  redirect(`/rh/employes/${data.id}`);
}

export async function updateHrEmployeeAction(employeeId: string, formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();

  const { error } = await supabase
    .from("hr_employees")
    .update({
      first_name: requiredString(formData, "first_name"),
      last_name: requiredString(formData, "last_name"),
      email: optionalString(formData, "email"),
      phone: optionalString(formData, "phone"),
      city: optionalString(formData, "city"),
      cin: validateCin(optionalString(formData, "cin")),
      cnss_number: validateCnss(optionalString(formData, "cnss_number")),
      rib: validateRib(optionalString(formData, "rib")),
      marital_status: optionalString(formData, "marital_status"),
      dependents_count: Math.max(0, Math.min(12, Math.round(numberValue(formData, "dependents_count")))),
      cimr_enabled: formData.get("cimr_enabled") === "on",
      cimr_rate: numberValue(formData, "cimr_rate"),
      mutuelle_label: optionalString(formData, "mutuelle_label"),
      mutuelle_amount: numberValue(formData, "mutuelle_amount"),
      weekly_hours: numberValue(formData, "weekly_hours") || 44,
      department_id: optionalString(formData, "department_id"),
      position_id: optionalString(formData, "position_id"),
      employment_status: optionalString(formData, "employment_status") ?? "active",
      base_salary: parseHrSalary(formData.get("base_salary")),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", employeeId);

  if (error) throw new Error(error.message);
  revalidatePath(`/rh/employes/${employeeId}`);
  redirect(`/rh/employes/${employeeId}`);
}

export async function createHrContractAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();

  const payload = {
    organization_id: workspace.organization.id,
    employee_id: requiredString(formData, "employee_id"),
    contract_number: requiredString(formData, "contract_number"),
    contract_type: requiredString(formData, "contract_type"),
    start_date: requiredString(formData, "start_date"),
    end_date: optionalString(formData, "end_date"),
    trial_period_end: optionalString(formData, "trial_period_end"),
    status: optionalString(formData, "status") ?? "active",
    weekly_hours: numberValue(formData, "weekly_hours", 44),
    base_salary: parseHrSalary(formData.get("base_salary")),
    clauses: optionalString(formData, "clauses"),
  };

  if (payload.weekly_hours <= 0 || payload.weekly_hours > 168) throw new Error("Les heures hebdomadaires doivent être comprises entre 0 et 168, hors zéro.");
  if (payload.end_date && payload.end_date < payload.start_date) throw new Error("La date de fin doit être postérieure ou égale au début du contrat.");
  const { data, error } = await supabase.from("hr_contracts").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/rh/contrats");
  redirect(`/rh/contrats/${data.id}`);
}

export async function createHrLeaveRequestAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();

  const employeeId = requiredString(formData, "employee_id");
  const startDate = requiredString(formData, "start_date");
  const endDate = requiredString(formData, "end_date");
  const { data: existingLeaves } = await supabase.from("hr_leave_requests").select("start_date, end_date, status").eq("organization_id", workspace.organization.id).eq("employee_id", employeeId).in("status", ["pending", "approved"]);
  if ((existingLeaves ?? []).some((row) => leaveRangesOverlap(startDate, endDate, String(row.start_date), String(row.end_date)))) {
    throw new Error(LEAVE_OVERLAP_MESSAGE);
  }
  const { error } = await supabase.from("hr_leave_requests").insert({
    organization_id: workspace.organization.id,
    employee_id: employeeId,
    leave_type_id: requiredString(formData, "leave_type_id"),
    start_date: startDate,
    end_date: endDate,
    days_count: numberValue(formData, "days_count", 1),
    reason: optionalString(formData, "reason"),
    status: "pending",
  });

  if (error) throw new Error(error.message.includes("HR_LEAVE_OVERLAP") ? LEAVE_OVERLAP_MESSAGE : error.message);
  revalidatePath("/rh/conges");
  redirect("/rh/conges");
}

export async function createHrPayrollPeriodAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();
  const month = numberValue(formData, "month", new Date().getMonth() + 1);
  const year = numberValue(formData, "year", new Date().getFullYear());
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new Error("Choisissez un mois et une année de paie valides.");
  }

  // Check if period already exists for this org/month/year
  const { data: existing, error: existingError } = await supabase
    .from("hr_payroll_periods")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  if (existingError) throw new Error("Impossible de vérifier la période de paie existante.");

  if (existing) {
    redirect(`/rh/paie/periodes/${existing.id}`);
  }

  const { data, error } = await supabase.from("hr_payroll_periods").insert({
    organization_id: workspace.organization.id,
    period_number: `PAIE-${year}-${String(month).padStart(2, "0")}`,
    month,
    year,
    period_start: `${year}-${String(month).padStart(2, "0")}-01`,
    period_end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
    status: "draft",
    created_by: workspace.userId,
  }).select("id").single();

  if (error) throw new Error(error.message);
  revalidatePath("/rh/paie");
  redirect(`/rh/paie/periodes/${data.id}`);
}

export async function calculateHrPayrollPeriodAction(periodId: string, formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const expected = optionalString(formData, "expected_updated_at");
  if (!expected) throw new Error("Actualisez la période avant de lancer le calcul : sa version est manquante.");
  if (!isBaseOnlyPayrollAcknowledgement(formData.get("ack_base_only"))) throw new Error("Confirmez la préparation du salaire de base uniquement. Les variables et la paie finale sont exclues.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_hr_payroll_atomic", {
    p_organization_id: workspace.organization.id, p_period_id: periodId,
    p_expected_updated_at: expected, p_ack_base_only: true,
  });
  if (error || !data || data.scope !== "base_only_preparatory") throw new Error(proTransactionError(error));
  revalidatePath(`/rh/paie/periodes/${periodId}`);
}

export async function prepareHrPayrollPeriodFormAction(periodId: string, previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  void previous;
  try {
    await calculateHrPayrollPeriodAction(periodId, formData);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "La préparation n’a pas pu être enregistrée. Actualisez puis réessayez." };
  }
}

export async function prepareFullPayslipFormAction(periodId: string, previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  void previous;
  try {
    const workspace = await requireWritableHrWorkspace();
    const employeeId = requiredString(formData, "employee_id");
    const supabase = await createClient();
    const { data: employee } = await supabase.from("hr_employees").select("id, base_salary, hire_date, first_name, last_name, dependents_count").eq("id", employeeId).eq("organization_id", workspace.organization.id).maybeSingle();
    const { data: period } = await supabase.from("hr_payroll_periods").select("id, year, month, status").eq("id", periodId).eq("organization_id", workspace.organization.id).maybeSingle();
    if (!employee || !period || !["draft", "calculated"].includes(period.status)) return { error: "Période ou salarié introuvable." };
    const weeklyHours = numberValue(formData, "weekly_hours") || 44;
    const overtimeFromHours = overtimePayFromHours(Number(employee?.base_salary ?? 0), {
      at25: numberValue(formData, "overtime_hours_25"),
      at50: numberValue(formData, "overtime_hours_50"),
      at100: numberValue(formData, "overtime_hours_100"),
    }, weeklyHours);
    const manualAdvance = numberValue(formData, "advance_deduction");
    const scheduled = manualAdvance > 0 ? manualAdvance : await deductionsForMonth(supabase, workspace.organization.id, employeeId, Number(period?.year), Number(period?.month));
    const formDependents = Math.max(0, Math.round(numberValue(formData, "dependents")));
    const variables = {
      bonuses: numberValue(formData, "bonuses"),
      overtimeAmount: overtimeFromHours.at25 + overtimeFromHours.at50 + overtimeFromHours.at100 > 0 ? overtimeFromHours.amount : numberValue(formData, "overtime_amount"),
      indemnities: numberValue(formData, "indemnities"),
      absenceDeduction: numberValue(formData, "absence_deduction"),
      advanceDeduction: scheduled,
      dependents: formDependents > 0 ? formDependents : Math.max(0, Math.round(Number(employee?.dependents_count ?? 0))),
    };
    const periodDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
    const slip = calculateMoroccanPayslip2026({
      baseSalary: Number(employee.base_salary ?? 0),
      hireDate: employee.hire_date,
      periodDate,
      ...variables,
    });
    const variablesSaved = await supabase.from("hr_payslip_variables").upsert({
      organization_id: workspace.organization.id,
      payroll_period_id: periodId,
      employee_id: employeeId,
      bonuses: variables.bonuses,
      overtime_amount: variables.overtimeAmount,
      indemnities: variables.indemnities,
      absence_deduction: variables.absenceDeduction,
      advance_deduction: variables.advanceDeduction,
      dependents: variables.dependents,
      updated_at: new Date().toISOString(),
    }, { onConflict: "payroll_period_id,employee_id" });
    const variablesPending = variablesSaved.error && (variablesSaved.error.code === "42P01" || variablesSaved.error.code === "PGRST205" || /does not exist|schema cache/i.test(variablesSaved.error.message ?? ""));
    const payslipNumber = `BUL-${period.year}-${String(period.month).padStart(2, "0")}-${employeeId}`;
    const payload = {
      organization_id: workspace.organization.id,
      payroll_period_id: periodId,
      employee_id: employeeId,
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
      advance_deduction: slip.advanceDeduction,
      cnss_employer: Math.round((slip.cnssEmployerSocial + slip.cnssEmployerFamily) * 100) / 100,
      amo_employer: slip.amoEmployer,
      earnings: [
        { code: "BASE", label: "Salaire de base", amount: slip.baseSalary },
        { code: "ANCIENNETE", label: `Prime d'ancienneté ${slip.seniorityPercent} %`, amount: slip.seniorityBonus },
        { code: "PRIME", label: "Primes", amount: variables.bonuses },
        { code: "HS", label: "Heures supplémentaires", amount: variables.overtimeAmount },
        { code: "INDEMNITE", label: "Indemnités", amount: variables.indemnities },
      ],
      deductions: [
        { code: "CNSS", label: "CNSS salarié", amount: slip.cnssEmployee },
        { code: "AMO", label: "AMO salarié", amount: slip.amoEmployee },
        { code: "IR", label: "IR", amount: slip.ir },
        { code: "AVANCE", label: "Avance", amount: slip.advanceDeduction },
      ],
      employer_contributions: [
        { code: "CNSS_ER", label: "CNSS employeur", amount: slip.cnssEmployerSocial + slip.cnssEmployerFamily },
        { code: "AMO_ER", label: "AMO employeur", amount: slip.amoEmployer },
        { code: "FORMATION", label: "Taxe de formation professionnelle", amount: slip.trainingTax },
      ],
      calculation_details: { scope: "elements_2026", officialConformityClaim: false, dependents: variables.dependents, slip: { ...slip, dependents: variables.dependents } },
      status: "calculated",
    };
    const saved = await supabase.from("hr_payslips").upsert(payload, { onConflict: "payroll_period_id,employee_id" });
    if (saved.error) return { error: saved.error.message };
    revalidatePath(`/rh/paie/periodes/${periodId}`);
    return variablesPending
      ? { success: true, error: "Bulletin enregistré dans la paie existante. Le détail des variables attend la migration 116." }
      : { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Le bulletin complet n'a pas pu être enregistré." };
  }
}

export async function refreshLeaveBalancesAction(previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  void previous;
  void formData;
  try {
    const workspace = await requireWritableHrWorkspace();
    const supabase = await createClient();
    const year = new Date().getFullYear();
    const { data: employees } = await supabase.from("hr_employees").select("id, hire_date").eq("organization_id", workspace.organization.id).is("archived_at", null);
    const { data: leaves } = await supabase.from("hr_leave_requests").select("employee_id, days_count, start_date, status").eq("organization_id", workspace.organization.id).eq("status", "approved");
    for (const employee of employees ?? []) {
      const hire = new Date(`${employee.hire_date}T00:00:00Z`);
      const start = new Date(Date.UTC(year, 0, 1));
      const from = hire > start ? hire : start;
      const months = Math.max(0, (new Date().getUTCFullYear() === year ? new Date().getUTCMonth() : 11) - from.getUTCMonth() + (from.getUTCFullYear() === year ? 1 : 0));
      const taken = (leaves ?? []).filter((leave) => leave.employee_id === employee.id && String(leave.start_date).startsWith(String(year))).reduce((sum, leave) => sum + Number(leave.days_count ?? 0), 0);
      const balance = leaveBalance(months, taken);
      const stored = await supabase.from("hr_leave_balances").upsert({
        organization_id: workspace.organization.id,
        employee_id: employee.id,
        leave_year: year,
        acquired_days: balance.acquired,
        taken_days: balance.taken,
        remaining_days: balance.remaining,
        updated_at: new Date().toISOString(),
      }, { onConflict: "employee_id,leave_year" });
      if (stored.error && (stored.error.code === "42P01" || stored.error.code === "PGRST205" || /does not exist|schema cache/i.test(stored.error.message ?? ""))) {
        return { error: "Le calcul est prêt, mais l'enregistrement des soldes attend la migration 116." };
      }
    }
    revalidatePath("/rh/conges/soldes");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Les soldes n'ont pas pu être enregistrés." };
  }
}

function requiredString(formData: FormData, key: string): string {
  const value = optionalString(formData, key);
  if (!value) throw new Error(`Champ obligatoire manquant : ${key}`);
  return value;
}

function optionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function deductionsForMonth(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, employeeId: string, year: number, month: number) {
  if (!year || !month) return 0;
  const advances = await supabase.from("hr_advances").select("amount, status, deduction_month, deduction_year").eq("organization_id", organizationId).eq("employee_id", employeeId).in("status", ["approved", "paid"]);
  let total = 0;
  if (!advances.error) {
    for (const row of advances.data ?? []) {
      if (Number(row.deduction_year) === year && Number(row.deduction_month) === month) total += Number(row.amount ?? 0);
    }
  }
  const loans = await supabase.from("hr_loans").select("monthly_deduction, remaining_amount, start_month, start_year, status").eq("organization_id", organizationId).eq("employee_id", employeeId).eq("status", "active");
  if (!loans.error) {
    for (const row of loans.data ?? []) {
      const started = Number(row.start_year) < year || (Number(row.start_year) === year && Number(row.start_month) <= month);
      if (started) total += Math.min(Number(row.monthly_deduction ?? 0), Number(row.remaining_amount ?? 0));
    }
  }
  return Math.round(total * 100) / 100;
}

function missingColumn(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "42703" || error?.code === "PGRST204" || /schema cache|column/i.test(message);
}

function numberValue(formData: FormData, key: string, fallback = 0): number {
  const raw = optionalString(formData, key);
  if (!raw) return fallback;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value)) throw new Error(`Montant ou nombre invalide : ${key}`);
  return value;
}
