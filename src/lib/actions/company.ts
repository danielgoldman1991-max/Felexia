"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { uploadOrganizationLogoForOrganization } from "@/lib/organization-actions";

export type CompanyState = { error: string | null; success: boolean; fieldErrors?: Record<string, string> };

function canManageCompanySettings(roleName: string | null): boolean {
  if (!roleName) return false;
  const normalized = roleName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return ["owner", "admin", "administrator", "administrateur"].includes(normalized);
}

export async function updateCompanyAction(
  _prev: CompanyState,
  formData: FormData,
): Promise<CompanyState> {
  try {
    const workspace = await requireActiveWorkspace();

    if (!canManageCompanySettings(workspace.role)) {
      return { error: "Vous n'avez pas les droits nécessaires.", success: false };
    }

    const supabase = await createClient();
    const data: Record<string, string | null> = {};
    const fields = [
      "legal_name", "commercial_name", "ice", "rc", "if_number",
      "cnss", "tax_identifier", "address", "city", "country",
      "phone", "email", "website", "activity", "currency", "footer_text",
    ];

    for (const field of fields) {
      const val = formData.get(field);
      data[field] = typeof val === "string" && val.trim() ? val.trim() : null;
    }

    const logoFile = formData.get("logo") as File | null;
    let logoUrl: string | null = null;
    let logoPath: string | null = null;

    if (logoFile && logoFile.size > 0) {
      const orgId = workspace.organization.id;
      const uploadResult = await uploadOrganizationLogoForOrganization(orgId, logoFile);
      if (!uploadResult.success) {
        return { error: uploadResult.error ?? "Erreur upload logo.", success: false };
      }
      logoUrl = uploadResult.logo_url ?? null;
      logoPath = uploadResult.logo_path ?? null;
    }

    const upsertData: Record<string, unknown> = {
      organization_id: workspace.organization.id,
      ...data,
    };

    // Ne mettre à jour le logo que si un nouveau fichier a été uploadé
    if (logoUrl !== null && logoPath !== null) {
      upsertData.logo_url = logoUrl;
      upsertData.logo_path = logoPath;
    }

    const { error } = await supabase
      .from("company_settings")
      .upsert(upsertData, { onConflict: "organization_id" });

    if (error) return { error: error.message, success: false };

    await logAudit(
      workspace.organization.id,
      "update_company_settings",
      "company_settings",
      workspace.organization.id,
      data,
    );

    revalidatePath("/parametres/entreprise");
    revalidatePath("/parametres/entreprise/**");
    return { error: null, success: true };
  } catch (err) {
    return { error: (err as Error).message, success: false };
  }
}
