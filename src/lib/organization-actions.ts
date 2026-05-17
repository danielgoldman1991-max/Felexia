"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const LOGO_BUCKET = "organization-logos";
const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const LOGO_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type LogoUploadResult = {
  success: boolean;
  error?: string;
  logo_url?: string;
  logo_path?: string;
};

function getRoleName(role: unknown): string | null {
  if (Array.isArray(role)) return getRoleName(role[0]);
  if (!role || typeof role !== "object") return null;
  const value = (role as { name?: unknown }).name;
  return typeof value === "string" ? value : null;
}

function canManageOrganizationRole(roleName: string | null): boolean {
  if (!roleName) return false;
  const normalized = roleName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return ["owner", "admin", "administrator", "administrateur"].includes(normalized);
}

function createUniqueLogoPath(organizationId: string, ext: string) {
  const timestamp = Date.now();
  const uniqueId =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);

  return `organizations/${organizationId}/logo-${timestamp}-${uniqueId}.${ext}`;
}

async function assertCanUpdateOrganizationLogo(organizationId: string) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase, error: "Vous devez être connecté pour modifier le logo." };
  }

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("id, status, role:roles(name)")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { supabase, error: error.message };
  }

  if (!membership) {
    return { supabase, error: "Votre compte n’est pas rattaché à cette organisation." };
  }

  const status = typeof membership.status === "string" ? membership.status.trim().toLowerCase() : "active";
  if (status && status !== "active") {
    return { supabase, error: "Votre rattachement à cette organisation n’est pas actif." };
  }

  const roleName = getRoleName(membership?.role);
  if (!canManageOrganizationRole(roleName)) {
    return { supabase, error: "Vous n’êtes pas autorisé à modifier le logo de cette organisation." };
  }

  return { supabase, error: null };
}

export async function uploadOrganizationLogoForOrganization(
  organizationId: string,
  logoFile: File | null,
): Promise<LogoUploadResult> {
  if (!organizationId) {
    return { success: false, error: "Organisation introuvable." };
  }

  if (!logoFile || logoFile.size === 0) {
    return { success: false, error: "Aucun logo à enregistrer." };
  }

  if (logoFile.size > MAX_LOGO_SIZE) {
    return { success: false, error: "Le logo ne doit pas dépasser 5 Mo." };
  }

  const ext = LOGO_MIME_TO_EXT[logoFile.type];
  if (!ext) {
    return { success: false, error: "Format logo non autorisé. Utilisez PNG, JPG ou WEBP." };
  }

  const { supabase, error: accessError } = await assertCanUpdateOrganizationLogo(organizationId);
  if (accessError) {
    return { success: false, error: accessError };
  }

  const { data: currentOrganization } = await supabase
    .from("organizations")
    .select("logo_path")
    .eq("id", organizationId)
    .maybeSingle();

  const previousLogoPath =
    typeof currentOrganization?.logo_path === "string"
      ? currentOrganization.logo_path
      : null;

  const logoPath = createUniqueLogoPath(organizationId, ext);
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(logoPath, logoFile, {
      contentType: logoFile.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    const message = uploadError.message.toLowerCase();
    if (message.includes("bucket")) {
      return { success: false, error: "Le bucket organization-logos est absent. Appliquez les migrations Supabase." };
    }
    if (message.includes("permission") || message.includes("policy") || message.includes("row-level security")) {
      return { success: false, error: "Vous n’êtes pas autorisé à modifier le logo de cette organisation." };
    }
    return { success: false, error: uploadError.message };
  }

  const { data: publicUrl } = supabase.storage
    .from(LOGO_BUCKET)
    .getPublicUrl(logoPath);

  const logoUrl = publicUrl.publicUrl;

  const { error: persistError } = await supabase.rpc("set_organization_logo", {
    p_organization_id: organizationId,
    p_logo_url: logoUrl,
    p_logo_path: logoPath,
  });

  if (persistError) {
    return { success: false, error: persistError.message };
  }

  if (
    previousLogoPath &&
    previousLogoPath !== logoPath &&
    previousLogoPath.startsWith(`organizations/${organizationId}/`)
  ) {
    const { error: removeError } = await supabase.storage
      .from(LOGO_BUCKET)
      .remove([previousLogoPath]);

    if (removeError) {
      console.warn("Logo precedent non supprime:", removeError.message);
    }
  }

  revalidatePath("/parametres/entreprise");
  revalidatePath("/facturation");
  revalidatePath("/vente");
  revalidatePath("/achats");

  return {
    success: true,
    logo_url: logoUrl,
    logo_path: logoPath,
  };
}

export async function uploadOrganizationLogo(formData: FormData): Promise<LogoUploadResult> {
  const organizationId = String(formData.get("organization_id") ?? "");
  const logoFile = formData.get("logo") as File | null;
  return uploadOrganizationLogoForOrganization(organizationId, logoFile);
}
