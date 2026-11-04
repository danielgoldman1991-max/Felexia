"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { isCheckKey } from "@/lib/hr/checks";
import { isMissingRelation, notifyOrganization } from "@/lib/hr/notify";
import { leaveBalance, serviceMonthsInYear } from "@/lib/hr/leave-balance";
import { SETTLEMENT_REASONS, computeFinalSettlement, type SettlementReason } from "@/lib/hr/settlement";
import { createClient } from "@/lib/supabase/server";

const reasons = new Set(SETTLEMENT_REASONS.map((item) => item.value));

export async function endHrContractAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const contractId = required(formData, "contract_id");
  const exitDate = required(formData, "exit_date");
  const reason = required(formData, "reason");
  if (!reasons.has(reason as SettlementReason)) throw new Error("Motif de fin de contrat inconnu.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exitDate)) throw new Error("Date de sortie invalide.");
  const noticeDays = numberValue(formData, "notice_days");
  const noticePaid = formData.get("notice_paid") === "on" || formData.get("notice_paid") === "true";
  const notes = optional(formData, "notes");
  const supabase = await createClient();

  const probe = await supabase.from("hr_final_settlements").select("id").limit(1);
  if (isMissingRelation(probe.error)) throw new Error("Le solde de tout compte attend la migration 123. Le contrat n'a pas été modifié.");

  const { data: contract, error } = await supabase
    .from("hr_contracts")
    .select("id, employee_id, contract_number, start_date, status, base_salary")
    .eq("organization_id", workspace.organization.id)
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!contract) throw new Error("Contrat introuvable.");
  if (contract.status === "terminated" || contract.status === "archived") throw new Error("Ce contrat est déjà clos.");
  if (exitDate < contract.start_date) throw new Error("La date de sortie doit être postérieure ou égale au début du contrat.");

  const { data: employee, error: employeeError } = await supabase
    .from("hr_employees")
    .select("id, full_name, hire_date, base_salary, employee_number")
    .eq("organization_id", workspace.organization.id)
    .eq("id", contract.employee_id)
    .maybeSingle();
  if (employeeError) throw new Error(employeeError.message);
  if (!employee) throw new Error("Salarié introuvable.");

  const year = Number(exitDate.slice(0, 4));
  const { data: approved } = await supabase
    .from("hr_leave_requests")
    .select("days_count, start_date")
    .eq("organization_id", workspace.organization.id)
    .eq("employee_id", employee.id)
    .eq("status", "approved");
  const taken = (approved ?? []).filter((row) => String(row.start_date).startsWith(String(year))).reduce((sum, row) => sum + Number(row.days_count ?? 0), 0);
  const balance = leaveBalance(serviceMonthsInYear(employee.hire_date, year, new Date(`${exitDate}T00:00:00Z`)), taken);
  const { data: lastSlip } = await supabase
    .from("hr_payslips")
    .select("net_to_pay, net_salary, status")
    .eq("organization_id", workspace.organization.id)
    .eq("employee_id", employee.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const monthly = Number(contract.base_salary || employee.base_salary || 0);
  const settlement = computeFinalSettlement({
    monthlySalary: monthly,
    hireDate: employee.hire_date,
    exitDate,
    reason: reason as SettlementReason,
    remainingLeaveDays: Math.max(0, balance.remaining),
    noticeDays,
    noticePaid,
    lastNet: Number(lastSlip?.net_to_pay ?? lastSlip?.net_salary ?? 0),
  });

  const closed = await supabase
    .from("hr_contracts")
    .update({ status: "terminated", end_date: exitDate })
    .eq("organization_id", workspace.organization.id)
    .eq("id", contractId)
    .neq("status", "terminated")
    .select("id")
    .maybeSingle();
  if (closed.error) throw new Error(closed.error.message);
  if (!closed.data) throw new Error("Ce contrat a déjà été clos.");

  const employeeUpdate = await supabase
    .from("hr_employees")
    .update({ employment_status: "terminated", exit_date: exitDate })
    .eq("organization_id", workspace.organization.id)
    .eq("id", employee.id);
  if (employeeUpdate.error) throw new Error(employeeUpdate.error.message);

  const number = `STC-${exitDate.replaceAll("-", "")}-${employee.employee_number ?? employee.id.slice(0, 8)}`;
  const saved = await supabase.from("hr_final_settlements").insert({
    organization_id: workspace.organization.id,
    employee_id: employee.id,
    contract_id: contract.id,
    settlement_number: number,
    exit_date: exitDate,
    reason,
    years_of_service: settlement.yearsOfService,
    monthly_salary: monthly,
    leave_days: Math.max(0, balance.remaining),
    leave_indemnity: settlement.leaveIndemnity,
    notice_days: noticeDays,
    notice_indemnity: settlement.noticeIndemnity,
    dismissal_indemnity: settlement.dismissalIndemnity,
    last_net: settlement.lastNet,
    total_amount: settlement.total,
    notes: [notes, ...settlement.notes].filter(Boolean).join("\n"),
    official_claim: false,
    created_by: workspace.userId,
  }).select("id").single();
  if (saved.error || !saved.data) throw new Error(saved.error?.message ?? "Le solde de tout compte n'a pas pu être enregistré.");

  await notifyOrganization(supabase, workspace.organization.id, {
    type: "hr_settlement",
    title: "Fin de contrat enregistrée",
    message: `${employee.full_name} · ${contract.contract_number} · solde préparatoire ${settlement.total.toFixed(2)} MAD.`,
    actionLabel: "Imprimer le solde",
    actionUrl: `/rh/offboarding/${saved.data.id}/print`,
    severity: "warning",
    metadata: { kind: "hr_settlement", settlement_id: saved.data.id },
  });

  revalidatePath("/rh/contrats");
  revalidatePath(`/rh/contrats/${contractId}`);
  revalidatePath("/rh/employes");
  revalidatePath("/rh/offboarding");
  redirect(`/rh/offboarding/${saved.data.id}/print`);
}

export async function toggleHrCheckAction(previous: { error?: string; success?: boolean }, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  void previous;
  try {
    const workspace = await requireWritableHrWorkspace();
    const employeeId = required(formData, "employee_id");
    const kind = required(formData, "kind");
    const itemKey = required(formData, "item_key");
    if (kind !== "onboarding" && kind !== "offboarding") return { error: "Liste inconnue." };
    if (!isCheckKey(kind, itemKey)) return { error: "Point de contrôle inconnu." };
    const done = formData.get("done") === "true";
    const supabase = await createClient();
    const saved = await supabase.from("hr_employee_checks").upsert({
      organization_id: workspace.organization.id,
      employee_id: employeeId,
      kind,
      item_key: itemKey,
      done,
      updated_at: new Date().toISOString(),
    }, { onConflict: "employee_id,kind,item_key" });
    if (isMissingRelation(saved.error)) return { error: "La liste d'arrivée ou de départ attend la migration 123." };
    if (saved.error) return { error: saved.error.message };
    revalidatePath(kind === "onboarding" ? "/rh/onboarding" : "/rh/offboarding");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Le point de contrôle n'a pas pu être enregistré." };
  }
}

function required(formData: FormData, key: string) {
  const value = optional(formData, key);
  if (!value) throw new Error(`Champ obligatoire manquant : ${key}`);
  return value;
}

function optional(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberValue(formData: FormData, key: string) {
  const raw = optional(formData, key);
  if (!raw) return 0;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) throw new Error("Le nombre de jours de préavis est invalide.");
  return value;
}

export async function createHrOperationalRecordAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const kind = required(formData, "kind");
  const supabase = await createClient();
  const employeeId = required(formData, "employee_id");
  const owned = await supabase.from("hr_employees").select("id").eq("organization_id", workspace.organization.id).eq("id", employeeId).maybeSingle();
  if (owned.error) throw new Error(owned.error.message);
  if (!owned.data) throw new Error("Salarié introuvable dans votre entreprise.");

  if (kind === "absence") {
    const saved = await supabase.from("hr_absences").insert({
      organization_id: workspace.organization.id,
      employee_id: employeeId,
      absence_date: required(formData, "absence_date"),
      absence_type: required(formData, "absence_type"),
      justified: formData.get("justified") === "on",
      reason: optional(formData, "reason"),
      status: "draft",
    }).select("id").single();
    if (saved.error) throw new Error(saved.error.message);
    revalidatePath("/rh/absences");
    redirect(`/rh/absences/${saved.data.id}`);
  }
  if (kind === "attendance") {
    const status = optional(formData, "status") ?? "present";
    if (!["present", "absent", "late", "half_day", "leave", "sick_leave", "remote", "holiday"].includes(status)) {
      throw new Error("Statut de présence inconnu.");
    }
    const saved = await supabase.from("hr_attendance").upsert({
      organization_id: workspace.organization.id,
      employee_id: employeeId,
      attendance_date: required(formData, "attendance_date"),
      worked_hours: positive(formData, "worked_hours"),
      overtime_hours: positive(formData, "overtime_hours"),
      status,
      source: "manual",
      notes: optional(formData, "notes"),
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,employee_id,attendance_date" }).select("id").single();
    if (saved.error) throw new Error(saved.error.message);
    revalidatePath("/rh/presences");
    redirect("/rh/presences");
  }
  if (kind === "advance") {
    const amount = money(formData, "amount");
    const saved = await supabase.from("hr_advances").insert({
      organization_id: workspace.organization.id,
      employee_id: employeeId,
      advance_number: required(formData, "advance_number"),
      request_date: required(formData, "request_date"),
      amount,
      status: "draft",
      notes: optional(formData, "notes"),
    }).select("id").single();
    if (saved.error) throw new Error(saved.error.message);
    revalidatePath("/rh/avances");
    redirect(`/rh/avances/${saved.data.id}`);
  }
  if (kind === "loan") {
    const amount = money(formData, "amount");
    const saved = await supabase.from("hr_loans").insert({
      organization_id: workspace.organization.id,
      employee_id: employeeId,
      loan_number: required(formData, "loan_number"),
      amount,
      monthly_deduction: money(formData, "monthly_deduction"),
      start_month: month(formData),
      start_year: year(formData),
      remaining_amount: amount,
      status: "active",
      notes: optional(formData, "notes"),
    }).select("id").single();
    if (saved.error) throw new Error(saved.error.message);
    revalidatePath("/rh/prets");
    redirect(`/rh/prets/${saved.data.id}`);
  }
  if (kind === "expense") {
    const amountHt = money(formData, "amount_ht");
    const tax = money(formData, "tax_amount");
    const saved = await supabase.from("hr_expense_reports").insert({
      organization_id: workspace.organization.id,
      employee_id: employeeId,
      expense_number: required(formData, "expense_number"),
      expense_date: required(formData, "expense_date"),
      category: required(formData, "category"),
      amount_ht: amountHt,
      tax_amount: tax,
      amount_ttc: Math.round((amountHt + tax) * 100) / 100,
      status: "submitted",
      notes: optional(formData, "notes"),
    }).select("id").single();
    if (saved.error) throw new Error(saved.error.message);
    revalidatePath("/rh/notes-de-frais");
    redirect(`/rh/notes-de-frais/${saved.data.id}`);
  }
  throw new Error("Opération RH inconnue.");
}

export async function setHrRecordStatusAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const kind = required(formData, "kind");
  const id = required(formData, "id");
  const status = required(formData, "status");
  const allowed: Record<string, { table: string; statuses: string[]; path: string }> = {
    absence: { table: "hr_absences", statuses: ["draft", "validated", "cancelled"], path: "/rh/absences" },
    advance: { table: "hr_advances", statuses: ["draft", "approved", "paid", "cancelled"], path: "/rh/avances" },
    loan: { table: "hr_loans", statuses: ["active", "suspended", "closed", "cancelled"], path: "/rh/prets" },
    expense: { table: "hr_expense_reports", statuses: ["submitted", "approved", "rejected", "paid"], path: "/rh/notes-de-frais" },
  };
  const target = allowed[kind];
  if (!target || !target.statuses.includes(status)) throw new Error("Statut non autorisé.");
  const supabase = await createClient();
  const patch: Record<string, string | null> = { status, updated_at: new Date().toISOString() };
  if ((kind === "advance" || kind === "expense") && (status === "approved" || status === "validated")) {
    patch.approved_by = workspace.userId;
    patch.approved_at = new Date().toISOString();
  }
  const updated = await supabase.from(target.table).update(patch).eq("organization_id", workspace.organization.id).eq("id", id).select("id").maybeSingle();
  if (updated.error) throw new Error(updated.error.message);
  if (!updated.data) throw new Error("Enregistrement introuvable.");
  revalidatePath(target.path);
  redirect(`${target.path}/${id}`);
}

function money(formData: FormData, key: string) {
  const value = Number((optional(formData, key) ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) throw new Error(`Montant invalide : ${key}`);
  return Math.round(value * 100) / 100;
}

function positive(formData: FormData, key: string) {
  const raw = optional(formData, key);
  if (!raw) return 0;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 24) throw new Error("Les heures doivent être comprises entre 0 et 24.");
  return value;
}

function month(formData: FormData) {
  const value = Number(required(formData, "start_month"));
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new Error("Mois de début invalide.");
  return value;
}

function year(formData: FormData) {
  const value = Number(required(formData, "start_year"));
  if (!Number.isInteger(value) || value < 2000 || value > 2200) throw new Error("Année de début invalide.");
  return value;
}
