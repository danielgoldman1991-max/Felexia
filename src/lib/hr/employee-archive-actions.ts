"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { createClient } from "@/lib/supabase/server";

export type EmployeeArchiveState = { success: boolean; error?: string };

/** Hide a wrongly imported employee. Contracts, payslips and leaves stay untouched. */
export async function archiveHrEmployeeAction(_previous: EmployeeArchiveState, formData: FormData): Promise<EmployeeArchiveState> {
  const workspace = await requireWritableHrWorkspace();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { success: false, error: "Salarié introuvable." };
  const supabase = await createClient();
  const saved = await supabase
    .from("hr_employees")
    .update({ archived_at: new Date().toISOString(), employment_status: "archived" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .is("archived_at", null)
    .select("id");
  if (saved.error) return { success: false, error: "L'archivage n'a pas abouti." };
  if (!saved.data?.length) return { success: false, error: "Le salarié n'a pas été archivé. Vérifiez vos droits, ou s'il est déjà archivé." };
  revalidatePath("/rh/employes");
  revalidatePath("/rh/dashboard");
  redirect("/rh/employes");
}
