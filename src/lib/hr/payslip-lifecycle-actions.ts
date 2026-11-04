"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { canTransitionPayslip } from "@/lib/hr/payslip-lifecycle";
import { logAudit } from "@/lib/audit";
import { postPayrollAccrualEntry, postPayrollPaymentEntry } from "@/lib/hr/payroll-posting";

function payrollMessage(message: string) {
  if (message.includes("PAYROLL_PREPARATORY_ONLY")) return "La validation du bulletin attend la migration 120. Le calcul enregistré reste disponible.";
  if (message.includes("PAYROLL_LOCKED")) return "Ce bulletin est figé. Les montants ne peuvent plus être modifiés.";
  if (message.includes("PAYROLL_STATUS_TRANSITION")) return "Passez le bulletin de brouillon à validé, puis à payé.";
  return message;
}

async function movePayslip(slipId: string, next: "validated" | "paid") {
  const workspace = await requireWritableHrWorkspace("paie");
  const supabase = await createClient();
  const { data: slip, error } = await supabase
    .from("hr_payslips")
    .select("id, status, payroll_period_id")
    .eq("organization_id", workspace.organization.id)
    .eq("id", slipId)
    .maybeSingle();
  if (error || !slip) return { success: false, error: "Bulletin introuvable." };
  if (!canTransitionPayslip(String(slip.status), next)) return { success: false, error: "Ce changement de statut n’est pas autorisé." };
  const { data: full } = await supabase.from("hr_payslips").select("payslip_number, gross_salary, net_to_pay, employer_cost, cnss_employee, cnss_employer, amo_employee, amo_employer, ir_amount, advance_deduction, employee_id, payroll_period_id").eq("id", slipId).maybeSingle();
  const [{ data: employee }, { data: period }] = await Promise.all([
    full?.employee_id ? supabase.from("hr_employees").select("first_name, last_name").eq("id", full.employee_id).maybeSingle() : Promise.resolve({ data: null }),
    full?.payroll_period_id ? supabase.from("hr_payroll_periods").select("year, month").eq("id", full.payroll_period_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const payDate = period ? new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const amounts = {
    id: slipId,
    payslipNumber: String(full?.payslip_number ?? slipId),
    employeeName: `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() || "Salarié",
    gross: Number(full?.gross_salary ?? 0),
    employerCost: Number(full?.employer_cost ?? 0),
    cnssEmployee: Number(full?.cnss_employee ?? 0),
    cnssEmployer: Number(full?.cnss_employer ?? 0),
    amoEmployee: Number(full?.amo_employee ?? 0),
    amoEmployer: Number(full?.amo_employer ?? 0),
    ir: Number(full?.ir_amount ?? 0),
    advances: Number(full?.advance_deduction ?? 0),
    loans: 0,
    netToPay: Number(full?.net_to_pay ?? 0),
    date: payDate,
  };
  if (next === "validated") {
    const posted = await postPayrollAccrualEntry(workspace.organization.id, amounts);
    if (!posted.success) return { success: false, error: posted.error };
    await logAudit(workspace.organization.id, "payroll_validated", "hr_payslips", slipId, { payslip: amounts.payslipNumber });
  }
  if (next === "paid") {
    const posted = await postPayrollPaymentEntry(workspace.organization.id, amounts);
    if (!posted.success) return { success: false, error: posted.error };
  }
  const payload = next === "paid"
    ? { status: "paid", paid_at: new Date().toISOString().slice(0, 10) }
    : { status: "validated" };
  const saved = await supabase.from("hr_payslips").update(payload).eq("organization_id", workspace.organization.id).eq("id", slipId);
  if (saved.error) return { success: false, error: payrollMessage(saved.error.message) };
  revalidatePath(`/rh/paie/periodes/${slip.payroll_period_id}`);
  revalidatePath(`/rh/paie/bulletins/${slipId}`);
  return { success: true };
}

export async function validatePayslipAction(_previous: { error?: string; success?: boolean }, formData: FormData) {
  void _previous;
  const id = String(formData.get("id") ?? "");
  if (!id) return { success: false, error: "Bulletin introuvable." };
  return movePayslip(id, "validated");
}

export async function markPayslipPaidAction(_previous: { error?: string; success?: boolean }, formData: FormData) {
  void _previous;
  const id = String(formData.get("id") ?? "");
  if (!id) return { success: false, error: "Bulletin introuvable." };
  return movePayslip(id, "paid");
}
