"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRoleKey } from "@/lib/env";
import { initializeOrganizationDefaults } from "@/lib/org-defaults";
import { ensureAccountingBaseSetup } from "@/lib/accounting";
import { formatMoroccanPhone, isValidMoroccanPhone } from "@/lib/morocco-format";
import { uploadOrganizationLogoForOrganization } from "@/lib/organization-actions";
import { ensureDefaultBusinessTrial } from "@/lib/subscriptions/plan-access";

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
    return { error: "Votre session a expiré. Veuillez vous reconnecter avant de créer l’entreprise." };
  }

  const raisonSociale = String(formData.get("raisonSociale") ?? "").trim().toLocaleUpperCase("fr-FR");
  const ville = String(formData.get("ville") ?? "").trim();
  const telephone = formatMoroccanPhone(String(formData.get("telephone") ?? "").trim());
  const emailEnt = String(formData.get("emailEnt") ?? "").trim().toLowerCase();
  const adresse = String(formData.get("adresse") ?? "").trim();
  const devise = "MAD";
  const logoFile = formData.get("logo") as File | null;

  const fieldErrors: Record<string, string> = {};

  if (raisonSociale.length < 2) {
    fieldErrors.raisonSociale = "La raison sociale est obligatoire.";
  }

  if (adresse.length < 5) {
    fieldErrors.adresse = "L’adresse complète est obligatoire.";
  }

  if (!ville) {
    fieldErrors.ville = "La ville est obligatoire.";
  }

  if (!String(formData.get("telephone") ?? "").trim()) {
    fieldErrors.telephone = "Le numéro de téléphone est obligatoire.";
  } else if (!isValidMoroccanPhone(telephone)) {
    fieldErrors.telephone = "Le numéro de téléphone doit respecter le format +212 524 10 10 10.";
  }

  if (!emailEnt) {
    fieldErrors.emailEnt = "L’adresse mail est obligatoire.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEnt)) {
    fieldErrors.emailEnt = "L’adresse mail est invalide.";
  }

  if (logoFile && logoFile.size > 0 && logoFile.size > 5 * 1024 * 1024) {
    fieldErrors.logo = "Logo trop volumineux (max 5 Mo)";
  }

  const allowedMime = ["image/png", "image/jpeg", "image/webp"];
  if (logoFile && logoFile.size > 0 && !allowedMime.includes(logoFile.type)) {
    fieldErrors.logo = "Format accepté : PNG, JPG, WEBP";
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

  let logoUrl: string | null = null;
  let logoPath: string | null = null;

  if (logoFile && logoFile.size > 0) {
    const uploadResult = await uploadOrganizationLogoForOrganization(orgId, logoFile);
    if (uploadResult.success) {
      logoUrl = uploadResult.logo_url ?? null;
      logoPath = uploadResult.logo_path ?? null;
    } else {
      console.error("createEntreprise: logo upload error", uploadResult.error);
    }
  }

  const { error: finalizeError } = await supabase.rpc("finalize_organization_onboarding", {
    p_organization_id: orgId,
    p_name: raisonSociale,
    p_address: adresse,
    p_city: ville,
    p_phone: telephone,
    p_email: emailEnt,
    p_currency: devise,
    p_logo_url: logoUrl,
    p_logo_path: logoPath,
  });

  if (finalizeError) {
    console.error("createEntreprise: finalize RPC error", finalizeError.message);
    if (finalizeError.message.toLowerCase().includes("function")) {
      return { error: "La fonction de finalisation de l’entreprise n’est pas installée. Veuillez appliquer les migrations Supabase puis réessayer." };
    }
    if (finalizeError.message.toLowerCase().includes("column")) {
      return { error: "Une colonne nécessaire à la finalisation de l’entreprise est absente. Veuillez appliquer les migrations Supabase puis réessayer." };
    }
    return { error: `Finalisation entreprise impossible : ${finalizeError.message}` };
  }

  try {
    await ensureAccountingBaseSetup(orgId);
  } catch (accountingErr) {
    console.error("createEntreprise: accounting defaults error", accountingErr);
  }

  try {
    await ensureDefaultBusinessTrial(orgId);
  } catch (subscriptionErr) {
    console.error("createEntreprise: subscription default error", subscriptionErr);
  }

  if (hasServiceRoleKey()) {
    try {
      await initializeOrganizationDefaults(orgId);
    } catch (defaultsErr) {
      console.error("createEntreprise: defaults initialization error", defaultsErr);
    }
  } else {
    console.warn("createEntreprise: SUPABASE_SERVICE_ROLE_KEY missing, defaults initialization skipped.");
  }

  redirect("/bienvenue");
}
