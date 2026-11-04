"use server";

import { revalidatePath } from "next/cache";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { createClient } from "@/lib/supabase/server";

export type HrSettingState = { success: boolean; error?: string };

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function codeFrom(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 32);
}

function duplicate(error: { code?: string; message?: string } | null, label: string) {
  if (!error) return null;
  if (error.code === "23505") return label;
  return error.message || "L'enregistrement n'a pas abouti.";
}

async function workspace() {
  return requireWritableHrWorkspace();
}

export async function saveHrDepartmentAction(_prev: HrSettingState, formData: FormData): Promise<HrSettingState> {
  const current = await workspace();
  const name = text(formData, "name");
  if (!name) return { success: false, error: "Le nom du département est obligatoire." };
  const supabase = await createClient();
  const id = text(formData, "id");
  const payload = { organization_id: current.organization.id, name, code: text(formData, "code") || codeFrom(name), is_active: formData.get("is_active") === "on" };
  const saved = id
    ? await supabase.from("hr_departments").update(payload).eq("organization_id", current.organization.id).eq("id", id)
    : await supabase.from("hr_departments").insert(payload);
  const error = duplicate(saved.error, "Un département porte déjà ce nom.");
  if (error) return { success: false, error };
  revalidatePath("/rh/parametres");
  return { success: true };
}

export async function saveHrPositionAction(_prev: HrSettingState, formData: FormData): Promise<HrSettingState> {
  const current = await workspace();
  const title = text(formData, "title");
  if (!title) return { success: false, error: "L'intitulé du poste est obligatoire." };
  const supabase = await createClient();
  const id = text(formData, "id");
  const payload = {
    organization_id: current.organization.id,
    title,
    code: text(formData, "code") || codeFrom(title),
    department_id: text(formData, "department_id"),
    is_active: formData.get("is_active") === "on",
  };
  const saved = id
    ? await supabase.from("hr_positions").update(payload).eq("organization_id", current.organization.id).eq("id", id)
    : await supabase.from("hr_positions").insert(payload);
  const error = duplicate(saved.error, "Un poste porte déjà cet intitulé.");
  if (error) return { success: false, error };
  revalidatePath("/rh/parametres");
  return { success: true };
}

export async function saveHrLeaveTypeAction(_prev: HrSettingState, formData: FormData): Promise<HrSettingState> {
  const current = await workspace();
  const name = text(formData, "name");
  const code = (text(formData, "code") || "").toUpperCase();
  if (!name || !code) return { success: false, error: "Le nom et le code du type de congé sont obligatoires." };
  const days = text(formData, "annual_entitlement_days");
  const annual = days === null ? null : Number(days.replace(",", "."));
  if (annual !== null && (!Number.isFinite(annual) || annual < 0 || annual > 365)) {
    return { success: false, error: "Le droit annuel doit être un nombre de jours entre 0 et 365." };
  }
  const supabase = await createClient();
  const id = text(formData, "id");
  const payload = { organization_id: current.organization.id, name, code, is_paid: formData.get("is_paid") === "on", annual_entitlement_days: annual, is_active: formData.get("is_active") === "on" };
  const saved = id
    ? await supabase.from("hr_leave_types").update(payload).eq("organization_id", current.organization.id).eq("id", id)
    : await supabase.from("hr_leave_types").insert(payload);
  const error = duplicate(saved.error, "Ce code de congé existe déjà.");
  if (error) return { success: false, error };
  revalidatePath("/rh/parametres");
  return { success: true };
}

export async function saveHrScheduleAction(_prev: HrSettingState, formData: FormData): Promise<HrSettingState> {
  const current = await workspace();
  const name = text(formData, "name");
  const workDays = text(formData, "work_days");
  const hours = Number(String(formData.get("weekly_hours") ?? "").replace(",", "."));
  if (!name || !workDays) return { success: false, error: "Le nom et les jours travaillés sont obligatoires." };
  if (!Number.isFinite(hours) || hours <= 0 || hours > 80) return { success: false, error: "Les heures hebdomadaires doivent être comprises entre 0 et 80." };
  const supabase = await createClient();
  const id = text(formData, "id");
  const payload = { organization_id: current.organization.id, name, weekly_hours: hours, work_days: workDays, notes: text(formData, "notes"), is_active: formData.get("is_active") === "on" };
  const saved = id
    ? await supabase.from("hr_work_schedules").update(payload).eq("organization_id", current.organization.id).eq("id", id)
    : await supabase.from("hr_work_schedules").insert(payload);
  const error = duplicate(saved.error, "Un horaire porte déjà ce nom.");
  if (error && (error.includes("does not exist") || error.includes("schema cache"))) {
    return { success: false, error: "Les horaires attendent la migration 137. Les autres référentiels restent disponibles." };
  }
  if (error) return { success: false, error };
  revalidatePath("/rh/parametres");
  return { success: true };
}
