"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type CompanyState = { error: string | null; success: boolean };

export async function updateCompanyAction(
  _prev: CompanyState,
  formData: FormData,
): Promise<CompanyState> {
  try {
    const workspace = await requireActiveWorkspace();

    if (workspace.role !== "owner" && workspace.role !== "admin") {
      return { error: "Vous n'avez pas les droits nécessaires.", success: false };
    }

    const supabase = await createClient();
    const data: Record<string, string | null> = {};
    const fields = [
      "legal_name", "commercial_name", "ice", "rc", "if_number",
      "cnss", "tax_identifier", "address", "city", "country",
      "phone", "email", "website", "activity", "currency",
    ];

    for (const field of fields) {
      const val = formData.get(field);
      data[field] = typeof val === "string" && val.trim() ? val.trim() : null;
    }

    const { error } = await supabase
      .from("company_settings")
      .upsert({
        organization_id: workspace.organization.id,
        ...data,
      }, { onConflict: "organization_id" });

    if (error) return { error: error.message, success: false };

    await logAudit(
      workspace.organization.id,
      "update_company_settings",
      "company_settings",
      workspace.organization.id,
      data,
    );

    revalidatePath("/parametres/entreprise");
    return { error: null, success: true };
  } catch (err) {
    return { error: (err as Error).message, success: false };
  }
}
