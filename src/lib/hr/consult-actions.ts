"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function required(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error("Renseignez tous les champs obligatoires.");
  return value;
}

export async function createHrEvaluationAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const { assertModulePermission } = await import("@/lib/auth/module-permission");
  await assertModulePermission(workspace, "rh", "write");
  const supabase = await createClient();
  const saved = await supabase.from("hr_evaluations").insert({
    organization_id: workspace.organization.id,
    employee_id: required(formData, "employee_id"),
    evaluation_date: required(formData, "evaluation_date"),
    period_label: text(formData, "period_label"),
    score: Number(text(formData, "score") ?? 0),
    strengths: text(formData, "strengths"),
    improvements: text(formData, "improvements"),
    goals: text(formData, "goals"),
    status: "draft",
  });
  if (saved.error) throw new Error(saved.error.message);
  revalidatePath("/rh/evaluations");
  redirect("/rh/evaluations");
}

export async function createHrDisciplineAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();
  const kind = required(formData, "action_type");
  if (!["observation", "warning", "blame", "suspension", "termination_notice", "other"].includes(kind)) {
    throw new Error("Type de sanction inconnu.");
  }
  const saved = await supabase.from("hr_disciplinary_actions").insert({
    organization_id: workspace.organization.id,
    employee_id: required(formData, "employee_id"),
    action_date: required(formData, "action_date"),
    action_type: kind,
    reason: required(formData, "reason"),
    decision: text(formData, "decision"),
    status: "draft",
  });
  if (saved.error) throw new Error(saved.error.message);
  revalidatePath("/rh/discipline");
  redirect("/rh/discipline");
}

export async function createHrDocumentAction(formData: FormData) {
  const workspace = await requireWritableHrWorkspace();
  const supabase = await createClient();
  const saved = await supabase.from("hr_documents").insert({
    organization_id: workspace.organization.id,
    employee_id: required(formData, "employee_id"),
    document_type: required(formData, "document_type"),
    title: required(formData, "title"),
    file_path: text(formData, "file_path"),
    file_url: text(formData, "file_url"),
    expires_at: text(formData, "expires_at"),
    status: "active",
    created_by: workspace.userId,
  });
  if (saved.error) throw new Error(saved.error.message);
  revalidatePath("/rh/documents");
  redirect("/rh/documents");
}

export async function createAgendaTaskAction(formData: FormData) {
  const { requireActiveWorkspace } = await import("@/lib/auth");
  const workspace = await requireActiveWorkspace({ modules: ["ventes", "achats"], level: "write" });
  const supabase = await createClient();
  const saved = await supabase.from("agenda_tasks").insert({
    organization_id: workspace.organization.id,
    title: required(formData, "title"),
    due_date: required(formData, "due_date"),
    third_party_id: text(formData, "third_party_id"),
    created_by: workspace.userId,
  });
  if (saved.error) throw new Error(saved.error.message.includes("agenda_tasks") ? "La création de tâches attend la migration 138." : saved.error.message);
  revalidatePath("/agenda");
  redirect("/agenda/taches");
}
