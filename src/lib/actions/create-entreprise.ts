"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { hasServiceRoleKey } from "@/lib/env";
import { initializeOrganizationDefaults } from "@/lib/org-defaults";

export type CreateEntrepriseState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

export async function createEntrepriseAction(
  _previousState: CreateEntrepriseState,
  formData: FormData,
): Promise<CreateEntrepriseState> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("createEntreprise: auth error", userError?.message);
    return { error: "Vous devez être connecté pour créer une entreprise." };
  }

  const raisonSociale = String(formData.get("raisonSociale") ?? "").trim();
  const ice = String(formData.get("ice") ?? "").trim();
  const ville = String(formData.get("ville") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();
  const emailEnt = String(formData.get("emailEnt") ?? "").trim();
  const adresse = String(formData.get("adresse") ?? "").trim();
  const secteur = String(formData.get("secteur") ?? "").trim();
  const taille = String(formData.get("taille") ?? "").trim();
  const devise = String(formData.get("devise") ?? "MAD");
  const logoFile = formData.get("logo") as File | null;

  const fieldErrors: Record<string, string> = {};

  if (!raisonSociale) {
    fieldErrors.raisonSociale = "Raison sociale requise";
  }

  if (logoFile && logoFile.size > 0 && logoFile.size > 5 * 1024 * 1024) {
    fieldErrors.logo = "Logo trop volumineux (max 5 Mo)";
  }

  const allowedMime = ["image/png", "image/jpg", "image/jpeg", "image/webp"];
  if (logoFile && logoFile.size > 0 && !allowedMime.includes(logoFile.type)) {
    fieldErrors.logo = "Format accepté : PNG, JPG, JPEG, WEBP";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Veuillez corriger les champs en erreur.", fieldErrors };
  }

  const slug = raisonSociale
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const adminName = user.user_metadata?.full_name as string | undefined;

  const { data: orgId, error: rpcError } = await supabase.rpc(
    "create_organization_with_owner",
    {
      p_name: raisonSociale,
      p_slug: slug,
      p_admin_name: adminName ?? null,
    },
  );

  if (rpcError) {
    console.error("createEntreprise: RPC error", rpcError.message);
    return { error: rpcError.message };
  }

  if (!orgId) {
    return { error: "Impossible de créer l'entreprise. Veuillez réessayer." };
  }

  if (!hasServiceRoleKey()) {
    return { error: "Configuration serveur incomplète. Veuillez contacter l'administrateur." };
  }

  const serviceClient = createServiceClient();

  let logoUrl: string | null = null;
  let logoPath: string | null = null;

  if (logoFile && logoFile.size > 0) {
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
    } else {
      console.error("createEntreprise: logo upload error", uploadErr.message);
    }
  }

  await serviceClient
    .from("organizations")
    .update({
      phone: telephone || null,
      email: emailEnt || null,
      city: ville || null,
      address: adresse || null,
      logo_url: logoUrl,
      logo_path: logoPath,
    })
    .eq("id", orgId);

  await serviceClient
    .from("company_settings")
    .upsert({
      organization_id: orgId,
      legal_name: raisonSociale,
      ice: ice || null,
      address: adresse || null,
      city: ville || null,
      phone: telephone || null,
      email: emailEnt || null,
      secteur: secteur || null,
      taille: taille || null,
      currency: devise,
      logo_url: logoUrl,
      logo_path: logoPath,
    }, { onConflict: "organization_id" });

  await initializeOrganizationDefaults(orgId);

  try {
    await serviceClient
      .from("profiles")
      .update({ default_organization_id: orgId })
      .eq("id", user.id);
  } catch (profileErr) {
    console.error("createEntreprise: profiles.update error", profileErr);
  }

  redirect("/onboarding/modules");
}
