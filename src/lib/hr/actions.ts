"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { createClient } from "@/lib/supabase/server";
import { parseHrSalary } from "@/lib/hr/validation";
import { proTransactionError } from "@/lib/pro-transaction-errors";
import { ensureHrReferenceData } from "@/lib/hr/reference-data";

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
    cin: optionalString(formData, "cin"),
    cnss_number: optionalString(formData, "cnss_number"),
    rib: optionalString(formData, "rib"),
    department_id: optionalString(formData, "department_id"),
    position_id: optionalString(formData, "position_id"),
    hire_date: requiredString(formData, "hire_date"),
    employment_status: optionalString(formData, "employment_status") ?? "active",
    base_salary: salary,
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

export async function calculateHrPayrollPeriodAction(periodId: string, formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const expected = optionalString(formData, "expected_updated_at");
  if (!expected) throw new Error("Actualisez la période avant de lancer le calcul : sa version est manquante.");
  if (formData.get("ack_base_only") !== "yes") throw new Error("Confirmez la préparation du salaire de base uniquement. Les variables et la paie finale sont exclues.");
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
  if (!Number.isFinite(value)) throw new Error(`Montant ou nombre invalide : ${key}`);
  return value;
}
