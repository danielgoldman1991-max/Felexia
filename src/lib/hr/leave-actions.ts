"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { isMissingRelation, notifyOrganization } from "@/lib/hr/notify";
import { decideLeave, type LeaveDecision, type LeaveStatus } from "@/lib/hr/leave-decision";
import { leaveBalance, leaveRangesOverlap, LEAVE_OVERLAP_MESSAGE, serviceMonthsInYear } from "@/lib/hr/leave-balance";
import { createClient } from "@/lib/supabase/server";

const decisions = new Set<LeaveDecision>(["approve", "reject", "cancel"]);

export async function decideHrLeaveAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const requestId = required(formData, "request_id");
  const decision = required(formData, "decision");
  if (!decisions.has(decision as LeaveDecision)) throw new Error("Décision inconnue.");
  const comment = optional(formData, "comment");
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("hr_leave_requests")
    .select("id, employee_id, leave_type_id, status, days_count, start_date")
    .eq("organization_id", workspace.organization.id)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!request) throw new Error("Demande de congé introuvable.");

  const year = Number(String(request.start_date).slice(0, 4));
  const [{ data: employee }, { data: leaveType }, { data: approved }] = await Promise.all([
    supabase.from("hr_employees").select("id, full_name, hire_date").eq("organization_id", workspace.organization.id).eq("id", request.employee_id).maybeSingle(),
    supabase.from("hr_leave_types").select("id, name, is_paid").eq("organization_id", workspace.organization.id).eq("id", request.leave_type_id).maybeSingle(),
    supabase.from("hr_leave_requests").select("days_count, start_date, status").eq("organization_id", workspace.organization.id).eq("employee_id", request.employee_id).eq("status", "approved"),
  ]);
  const taken = (approved ?? [])
    .filter((row) => String(row.start_date).startsWith(String(year)))
    .reduce((sum, row) => sum + Number(row.days_count ?? 0), 0);
  const months = employee?.hire_date ? serviceMonthsInYear(employee.hire_date, year) : 0;
  const balance = leaveBalance(months, taken);
  const countsAgainstBalance = leaveType?.is_paid !== false;
  const result = decideLeave({
    status: request.status as LeaveStatus,
    days: Number(request.days_count),
    remainingDays: balance.remaining,
    decision: decision as LeaveDecision,
    countsAgainstBalance,
  });
  if (!result.ok) throw new Error(result.message);
  if (result.nextStatus === "approved") {
    const { data: others } = await supabase.from("hr_leave_requests").select("id, start_date, end_date, status").eq("organization_id", workspace.organization.id).eq("employee_id", request.employee_id).in("status", ["pending", "approved"]).neq("id", requestId);
    const { data: current } = await supabase.from("hr_leave_requests").select("start_date, end_date").eq("id", requestId).maybeSingle();
    if (current && (others ?? []).some((row) => leaveRangesOverlap(String(current.start_date), String(current.end_date), String(row.start_date), String(row.end_date)))) {
      throw new Error(LEAVE_OVERLAP_MESSAGE);
    }
  }

  const patch: Record<string, string | null> = { status: result.nextStatus };
  if (result.nextStatus === "approved") {
    patch.approved_by = workspace.userId;
    patch.approved_at = new Date().toISOString();
    patch.rejected_reason = null;
  } else if (result.nextStatus === "rejected") {
    patch.approved_by = workspace.userId;
    patch.approved_at = new Date().toISOString();
    patch.rejected_reason = comment ?? "Refusée";
  } else {
    patch.rejected_reason = comment;
  }
  const updated = await supabase
    .from("hr_leave_requests")
    .update(patch)
    .eq("organization_id", workspace.organization.id)
    .eq("id", requestId)
    .eq("status", request.status)
    .select("id")
    .maybeSingle();
  if (updated.error) throw new Error(updated.error.message);
  if (!updated.data) throw new Error("Cette demande a déjà été traitée. Actualisez la page.");

  await storeBalance(supabase, workspace.organization.id, request.employee_id, year, employee?.hire_date ?? null);
  const history = await supabase.from("hr_leave_decisions").insert({
    organization_id: workspace.organization.id,
    leave_request_id: requestId,
    employee_id: request.employee_id,
    decision,
    previous_status: request.status,
    next_status: result.nextStatus,
    days_count: Number(request.days_count),
    balance_delta: result.takenDelta,
    comment,
    decided_by: workspace.userId,
  });
  if (history.error && !isMissingRelation(history.error)) throw new Error(history.error.message);

  await notifyOrganization(supabase, workspace.organization.id, {
    type: "hr_leave_decision",
    title: result.nextStatus === "approved" ? "Congé accepté" : result.nextStatus === "rejected" ? "Congé refusé" : "Congé annulé",
    message: `${employee?.full_name ?? "Un salarié"} · ${Number(request.days_count)} jour(s) à partir du ${request.start_date}. ${result.message}`,
    actionLabel: "Voir la demande",
    actionUrl: `/rh/conges/${requestId}`,
    severity: result.nextStatus === "rejected" ? "warning" : "success",
    metadata: { kind: "hr_leave", request_id: requestId },
  });

  revalidatePath("/rh/conges");
  revalidatePath("/rh/conges/soldes");
  revalidatePath(`/rh/conges/${requestId}`);
  redirect(`/rh/conges/${requestId}`);
}

async function storeBalance(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, employeeId: string, year: number, hireDate: string | null) {
  const { data: approved } = await supabase.from("hr_leave_requests").select("days_count, start_date").eq("organization_id", organizationId).eq("employee_id", employeeId).eq("status", "approved");
  const taken = (approved ?? []).filter((row) => String(row.start_date).startsWith(String(year))).reduce((sum, row) => sum + Number(row.days_count ?? 0), 0);
  const months = hireDate ? serviceMonthsInYear(hireDate, year) : 0;
  const balance = leaveBalance(months, taken);
  const stored = await supabase.from("hr_leave_balances").upsert({
    organization_id: organizationId,
    employee_id: employeeId,
    leave_year: year,
    acquired_days: balance.acquired,
    taken_days: balance.taken,
    remaining_days: balance.remaining,
    updated_at: new Date().toISOString(),
  }, { onConflict: "employee_id,leave_year" });
  if (stored.error && !isMissingRelation(stored.error)) throw new Error(stored.error.message);
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
