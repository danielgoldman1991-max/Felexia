"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { hasServiceRoleKey } from "@/lib/env";
import { requireActiveWorkspace } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export type CompanyState = { error: string | null; success: boolean; fieldErrors?: Record<string, string> };

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
      if (logoFile.size > 5 * 1024 * 1024) {
        return { error: "Logo trop volumineux (max 5 Mo).", success: false };
      }

      const allowedMime = ["image/png", "image/jpg", "image/jpeg", "image/webp"];
      if (!allowedMime.includes(logoFile.type)) {
        return { error: "Format accepté : PNG, JPG, JPEG, WEBP", success: false };
      }

      if (!hasServiceRoleKey()) {
        return { error: "Configuration serveur incomplète.", success: false };
      }

      const serviceClient = createServiceClient();
      const orgId = workspace.organization.id;
      const ext = logoFile.name.split(".").pop() ?? "png";
      logoPath = `organization-logos/${orgId}/logo.${ext}`;

      const { data: buckets } = await serviceClient.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.name === "organization-logos");
      if (!bucketExists) {
        await serviceClient.storage.createBucket("organization-logos", {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: ["image/png", "image/jpg", "image/jpeg", "image/webp"],
        });
      }

      const { error: uploadErr } = await serviceClient.storage
        .from("organization-logos")
        .upload(logoPath, logoFile, {
          contentType: logoFile.type,
          upsert: true,
        });

      if (!uploadErr) {
        const { data: pubUrl } = serviceClient.storage
          .from("organization-logos")
          .getPublicUrl(logoPath);
        logoUrl = pubUrl?.publicUrl ?? null;
      }
    }

    const { error } = await supabase
      .from("company_settings")
      .upsert({
        organization_id: workspace.organization.id,
        ...data,
        logo_url: logoUrl,
        logo_path: logoPath,
      }, { onConflict: "organization_id" });

    if (error) return { error: error.message, success: false };

    await supabase
      .from("organizations")
      .update({
        logo_url: logoUrl,
        logo_path: logoPath,
      })
      .eq("id", workspace.organization.id);

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
