"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { canTransitionPayslip } from "@/lib/hr/payslip-lifecycle";

function payrollMessage(message: string) {
  if (message.includes("PAYROLL_PREPARATORY_ONLY")) return "La validation du bulletin attend la migration 120. Le calcul enregistré reste disponible.";
  if (message.includes("PAYROLL_LOCKED")) return "Ce bulletin est figé. Les montants ne peuvent plus être modifiés.";
  if (message.includes("PAYROLL_STATUS_TRANSITION")) return "Passez le bulletin de brouillon à validé, puis à payé.";
  return message;
}

async function movePayslip(slipId: string, next: "validated" | "paid") {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();
  const { data: slip, error } = await supabase
    .from("hr_payslips")
    .select("id, status, payroll_period_id")
    .eq("organization_id", workspace.organization.id)
    .eq("id", slipId)
    .maybeSingle();
  if (error || !slip) return { success: false, error: "Bulletin introuvable." };
  if (!canTransitionPayslip(String(slip.status), next)) return { success: false, error: "Ce changement de statut n’est pas autorisé." };
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
