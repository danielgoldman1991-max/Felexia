"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRoleKey } from "@/lib/env";
import { initializeOrganizationDefaults } from "@/lib/org-defaults";
import { ensureAccountingBaseSetup } from "@/lib/accounting";
import { isValidMoroccanPhone } from "@/lib/morocco-format";
import { uploadOrganizationLogoForOrganization } from "@/lib/organization-actions";
import { validateCompanyConfirmationInput } from "@/lib/ice/ice";
import {
  startDefaultTrialAndEnableModules,
} from "@/lib/subscriptions/plan-access";

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

  const confirmation = validateCompanyConfirmationInput({
    raisonSociale: String(formData.get("raisonSociale") ?? ""),
    formeJuridique: String(formData.get("formeJuridique") ?? ""),
    ice: String(formData.get("ice") ?? ""),
    identifiantFiscal: String(formData.get("identifiantFiscal") ?? ""),
    rc: String(formData.get("rc") ?? ""),
    villeRc: String(formData.get("villeRc") ?? ""),
    cnss: String(formData.get("cnss") ?? ""),
    adresse: String(formData.get("adresse") ?? ""),
    ville: String(formData.get("ville") ?? ""),
    telephone: String(formData.get("telephone") ?? ""),
    emailEnt: String(formData.get("emailEnt") ?? ""),
    website: String(formData.get("website") ?? ""),
    activite: String(formData.get("activite") ?? ""),
    secteur: String(formData.get("secteur") ?? ""),
  });

  const {
    raisonSociale,
    formeJuridique,
    ice,
    identifiantFiscal,
    rc,
    villeRc,
    cnss,
    adresse,
    ville,
    telephone,
    emailEnt,
    website,
    activite,
  } = confirmation.normalized;
  const devise = "MAD";
  const logoFile = formData.get("logo") as File | null;

  const fieldErrors: Record<string, string> = { ...confirmation.errors };

  if (telephone && !isValidMoroccanPhone(telephone)) {
    fieldErrors.telephone = "Le numéro de téléphone doit respecter le format +212 524 10 10 10.";
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

  const adminFirstName = String(formData.get("adminFirstName") ?? "").trim();
  const adminLastName = String(formData.get("adminLastName") ?? "").trim();
  const adminName =
    [adminFirstName, adminLastName].filter(Boolean).join(" ") ||
    (user.user_metadata?.full_name as string | undefined) ||
    null;

  if (adminFirstName || adminLastName) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        first_name: adminFirstName || null,
        last_name: adminLastName || null,
        full_name: adminName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("createEntreprise: profile update error", profileError.message);
    }

    try {
      await supabase.auth.updateUser({
        data: {
          full_name: adminName,
          first_name: adminFirstName,
          last_name: adminLastName,
        },
      });
    } catch (metaErr) {
      console.error("createEntreprise: updateUser metadata error", metaErr);
    }
  }

  const { data: orgId, error: rpcError } = await supabase.rpc(
    "create_organization_with_owner",
    {
      p_name: raisonSociale,
      p_slug: slug,
      p_admin_name: adminName,
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

  const legalPayload = {
    legal_name: raisonSociale,
    commercial_name: raisonSociale,
    ice: ice || null,
    rc: rc || null,
    if_number: identifiantFiscal || null,
    tax_identifier: identifiantFiscal || null,
    cnss: cnss || null,
    forme_juridique: formeJuridique || null,
    ville_rc: villeRc || null,
    address: adresse,
    city: ville,
    phone: telephone,
    email: emailEnt,
    website: website || null,
    activity: activite || null,
    currency: devise,
  };

  const { error: orgUpdateError } = await supabase
    .from("organizations")
    .update({
      ...legalPayload,
      onboarding_step: "completed",
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (orgUpdateError) {
    console.error("createEntreprise: org update error", orgUpdateError.message);
  }

  const { error: companySettingsError } = await supabase
    .from("company_settings")
    .upsert(
      {
        organization_id: orgId,
        ...legalPayload,
        logo_url: logoUrl,
        logo_path: logoPath,
      },
      { onConflict: "organization_id" },
    );

  if (companySettingsError) {
    console.error("createEntreprise: company settings upsert error", companySettingsError.message, companySettingsError.details);
    const msg = companySettingsError.message.toLowerCase();
    if (msg.includes("column") || msg.includes("relation") || msg.includes("does not exist")) {
      return { error: "La table company_settings est incomplète. Veuillez appliquer les migrations Supabase (supabase db push) puis réessayer." };
    }
    if (msg.includes("permission") || msg.includes("policy") || msg.includes("violat")) {
      return { error: "Permission refusée. Veuillez vous reconnecter puis réessayer." };
    }
    return { error: `Erreur lors de l'enregistrement : ${companySettingsError.message}` };
  }

  try {
    await startDefaultTrialAndEnableModules(orgId, user.id);
  } catch (trialErr) {
    console.error("createEntreprise: trial activation error", trialErr);
    return {
      error: "Votre entreprise a été créée, mais l’activation de l’essai Essentiel ou des modules a échoué. Veuillez contacter le support ou réessayer.",
    };
  }

  try {
    await ensureAccountingBaseSetup(orgId);
  } catch (accountingErr) {
    console.error("createEntreprise: accounting defaults error", accountingErr);
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

  redirect("/dashboard?trial_started=1&company_created=1");
}
