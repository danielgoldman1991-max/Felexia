"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { createClient } from "@/lib/supabase/server";
import { calculatePayslip } from "@/lib/hr/payroll-engine";
import { ensureHrReferenceData } from "@/lib/hr/reference-data";
import type { HrSettings } from "@/lib/hr/types";

export async function createHrEmployeeAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
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
    cin: optionalString(formData, "cin"),
    cnss_number: optionalString(formData, "cnss_number"),
    rib: optionalString(formData, "rib"),
    department_id: optionalString(formData, "department_id"),
    position_id: optionalString(formData, "position_id"),
    hire_date: requiredString(formData, "hire_date"),
    employment_status: optionalString(formData, "employment_status") ?? "active",
    base_salary: numberValue(formData, "base_salary"),
    created_by: workspace.userId,
  };

  const { data, error } = await supabase.from("hr_employees").insert(payload).select("id").single();
  if (error) throw new Error(error.message);

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
      cin: optionalString(formData, "cin"),
      cnss_number: optionalString(formData, "cnss_number"),
      rib: optionalString(formData, "rib"),
      department_id: optionalString(formData, "department_id"),
      position_id: optionalString(formData, "position_id"),
      employment_status: optionalString(formData, "employment_status") ?? "active",
      base_salary: numberValue(formData, "base_salary"),
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
    base_salary: numberValue(formData, "base_salary"),
    clauses: optionalString(formData, "clauses"),
  };

  const { data, error } = await supabase.from("hr_contracts").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/rh/contrats");
  redirect(`/rh/contrats/${data.id}`);
}

export async function createHrLeaveRequestAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();

  const { error } = await supabase.from("hr_leave_requests").insert({
    organization_id: workspace.organization.id,
    employee_id: requiredString(formData, "employee_id"),
    leave_type_id: requiredString(formData, "leave_type_id"),
    start_date: requiredString(formData, "start_date"),
    end_date: requiredString(formData, "end_date"),
    days_count: numberValue(formData, "days_count", 1),
    reason: optionalString(formData, "reason"),
    status: "pending",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/rh/conges");
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

export async function calculateHrPayrollPeriodAction(periodId: string) {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();

  const [periodResult, employeesResult, settingsResult, payslipsResult] = await Promise.all([
    supabase.from("hr_payroll_periods").select("*").eq("organization_id", workspace.organization.id).eq("id", periodId).maybeSingle(),
    supabase.from("hr_employees").select("id, full_name, base_salary").eq("organization_id", workspace.organization.id).is("archived_at", null).in("employment_status", ["active", "trial_period", "on_leave"]),
    supabase.from("hr_settings").select("*").eq("organization_id", workspace.organization.id).maybeSingle(),
    supabase.from("hr_payslips").select("employee_id,status").eq("organization_id", workspace.organization.id).eq("payroll_period_id", periodId),
  ]);

  if (periodResult.error || employeesResult.error || settingsResult.error || payslipsResult.error) {
    throw new Error("Impossible de charger toutes les données de paie. Aucun calcul n’a été enregistré.");
  }
  const period = periodResult.data;
  const employees = employeesResult.data ?? [];
  const settings = settingsResult.data;
  if (!period) throw new Error("Période de paie introuvable.");
  if (!["draft", "calculated"].includes(period.status)) {
    throw new Error("Une période validée, payée ou archivée ne peut pas être recalculée.");
  }
  const employeeIds = new Set(employees.map(employee => employee.id));
  if ((payslipsResult.data ?? []).some(payslip => !employeeIds.has(payslip.employee_id) || !["draft", "calculated"].includes(payslip.status))) {
    throw new Error("La période contient des bulletins finalisés ou des salariés sortis du calcul. Vérifiez ses bulletins avant de recalculer.");
  }
  if (employees.some(employee => !Number.isFinite(Number(employee.base_salary)) || Number(employee.base_salary) < 0)) {
    throw new Error("Un salaire de base est invalide. Corrigez le dossier salarié avant de calculer la paie.");
  }

  let totalGross = 0;
  let totalNet = 0;
  let totalEmployerCost = 0;
  const payslips = [];

  for (const employee of employees) {
    const result = calculatePayslip(employee, settings as HrSettings | null);
    totalGross += result.grossSalary;
    totalNet += result.netToPay;
    totalEmployerCost += result.employerCost;

    payslips.push({
      organization_id: workspace.organization.id,
      payroll_period_id: periodId,
      employee_id: employee.id,
      payslip_number: `BUL-${period.year}-${String(period.month).padStart(2, "0")}-${String(employee.id).slice(0, 6)}`,
      base_salary: Number(employee.base_salary ?? 0),
      gross_salary: result.grossSalary,
      taxable_gross: result.taxableGross,
      net_salary: result.netSalary,
      net_to_pay: result.netToPay,
      employer_cost: result.employerCost,
      cnss_employee: result.cnssEmployee,
      amo_employee: result.amoEmployee,
      ir_amount: result.irAmount,
      cnss_employer: result.cnssEmployer,
      amo_employer: result.amoEmployer,
      earnings: result.earnings,
      deductions: result.deductions,
      employer_contributions: result.employerContributions,
      calculation_details: result.calculationDetails,
      status: "calculated",
    });
  }

  if (payslips.length > 0) {
    // One database statement: an invalid payslip cannot persist only part of
    // this batch. The final period update remains a separate request.
    const { error } = await supabase.from("hr_payslips").upsert(payslips, { onConflict: "payroll_period_id,employee_id" });
    if (error) throw new Error("Les bulletins n’ont pas pu être enregistrés. La période n’a pas été finalisée.");
  }

  const { data: savedPeriod, error: periodError } = await supabase
    .from("hr_payroll_periods")
    .update({
      status: "calculated",
      total_gross: totalGross,
      total_net: totalNet,
      total_employer_cost: totalEmployerCost,
      employees_count: employees.length,
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", periodId)
    .in("status", ["draft", "calculated"])
    .select("id")
    .maybeSingle();

  if (periodError || !savedPeriod) {
    throw new Error("Les bulletins ont été calculés, mais la période n’a pas pu être finalisée. Actualisez et vérifiez ses totaux avant de continuer.");
  }

  revalidatePath(`/rh/paie/periodes/${periodId}`);
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

function numberValue(formData: FormData, key: string, fallback = 0): number {
  const raw = optionalString(formData, key);
  if (!raw) return fallback;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
}
