"use server";

import { revalidatePath } from "next/cache";
import { requireWritableHrWorkspace } from "@/lib/hr/access";
import { employeeImportDecision, parseEmployeeCsv, type EmployeeCsvRow } from "@/lib/hr/validation";
import { isMissingSchema } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";

export type EmployeeImportState = {
  success: boolean;
  error?: string;
  errors: string[];
  rows: EmployeeCsvRow[];
  imported?: number;
};

const empty: EmployeeImportState = { success: false, errors: [], rows: [] };

function csvText(formData: FormData) {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) return file.text();
  return Promise.resolve(String(formData.get("csv") ?? ""));
}

export async function previewEmployeeImportAction(_prev: EmployeeImportState, formData: FormData): Promise<EmployeeImportState> {
  await requireWritableHrWorkspace();
  const parsed = parseEmployeeCsv(await csvText(formData));
  const decision = employeeImportDecision(parsed);
  return {
    success: decision.ok,
    error: decision.ok ? undefined : decision.error,
    errors: decision.ok ? [] : parsed.errors.filter((item) => item !== decision.error),
    rows: parsed.rows,
  };
}

export async function importEmployeesAction(_prev: EmployeeImportState, formData: FormData): Promise<EmployeeImportState> {
  const workspace = await requireWritableHrWorkspace();
  const parsed = parseEmployeeCsv(await csvText(formData));
  const decision = employeeImportDecision(parsed);
  if (!decision.ok) return { success: false, error: decision.error, errors: parsed.errors.filter((item) => item !== decision.error), rows: parsed.rows };
  const supabase = await createClient();
  const saved = await supabase.rpc("import_hr_employees_batch", {
    p_organization_id: workspace.organization.id,
    p_rows: decision.rows,
  });
  if (saved.error) {
    if (isMissingSchema(saved.error) || saved.error.code === "PGRST202" || saved.error.code === "42883") {
      return { ...empty, error: "L'import attend la migration 142. Aucun salarié n'a été créé." };
    }
    if (saved.error.code === "23505") {
      return { ...empty, errors: parsed.errors, rows: parsed.rows, error: "Un matricule existe déjà. Aucun salarié de ce fichier n'a été créé." };
    }
    if ((saved.error.message ?? "").includes("HR_IMPORT_FORBIDDEN")) {
      return { ...empty, error: "Vous n'avez pas les droits nécessaires pour importer des salariés." };
    }
    return { ...empty, errors: parsed.errors, rows: parsed.rows, error: "L'import a été annulé. Aucun salarié n'a été créé." };
  }
  revalidatePath("/rh/employes");
  return { success: true, errors: [], rows: decision.rows, imported: Number(saved.data ?? decision.rows.length) };
}
