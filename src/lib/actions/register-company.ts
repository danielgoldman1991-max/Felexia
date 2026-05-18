"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { initializeOrganizationDefaults } from "@/lib/org-defaults";
import { DEFAULT_PLAN_CODE, DEFAULT_TRIAL_DAYS, getEnabledModulesForPlan, getPlanDefinition } from "@/lib/subscriptions/plans";

export type RegisterCompanyState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function registerCompanyAction(
  _previousState: RegisterCompanyState,
  formData: FormData,
): Promise<RegisterCompanyState> {
  const supabase = await createClient();

  // ── Extract all fields ──────────────────────────────────────────────────────
  const firstName    = String(formData.get("firstName") ?? "").trim();
  const lastName     = String(formData.get("lastName") ?? "").trim();
  const email        = String(formData.get("email") ?? "").trim().toLowerCase();
  const password     = String(formData.get("password") ?? "");
  const phone        = String(formData.get("phone") ?? "").trim();

  const raisonSociale = String(formData.get("raisonSociale") ?? "").trim();
  const ice          = String(formData.get("ice") ?? "").trim();
  const ville        = String(formData.get("ville") ?? "").trim();
  const tel          = String(formData.get("tel") ?? "").trim();
  const emailEnt     = String(formData.get("emailEnt") ?? "").trim();
  const adresse      = String(formData.get("adresse") ?? "").trim();
  const secteur      = String(formData.get("secteur") ?? "");
  const taille       = String(formData.get("taille") ?? "");

  const logoFile = formData.get("logo") as File | null;

  // ── Validation ──────────────────────────────────────────────────────────────
  const fieldErrors: Record<string, string> = {};

  if (!firstName) fieldErrors.firstName = "Prénom requis";
  if (!lastName) fieldErrors.lastName = "Nom requis";
  if (!email || !email.includes("@")) fieldErrors.email = "Email valide requis";
  if (!password || password.length < 8) fieldErrors.password = "Minimum 8 caractères";
  if (!raisonSociale) fieldErrors.raisonSociale = "Raison sociale requise";

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

  const slug = generateSlug(raisonSociale);

  // ── 1. Create auth user ────────────────────────────────────────────────────
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: `${firstName} ${lastName}`,
        phone,
      },
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  if (!authData.user) {
    return { error: "Impossible de créer le compte utilisateur." };
  }

  const userId = authData.user.id;
  const svc = createServiceClient();

  // ── 2. Upsert profile ──────────────────────────────────────────────────────
  await svc.from("profiles").upsert({
    id: userId,
    email,
    full_name: `${firstName} ${lastName}`,
  }, { onConflict: "id" });

  // ── 3. Create organization ─────────────────────────────────────────────────
  const { data: org, error: orgError } = await svc
    .from("organizations")
    .insert({
      name: raisonSociale,
      slug,
      ice: ice || null,
      city: ville || null,
      phone: tel || null,
      email: emailEnt || null,
      address: adresse || null,
      activity: secteur || null,
      currency: "MAD",
    })
    .select("id")
    .single();

  if (orgError || !org) {
    console.error("registerCompany: org insert error", orgError?.message);
    return { error: "Impossible de créer l'organisation." };
  }

  const orgId = org.id;

  // ── 4. Create admin role ────────────────────────────────────────────────────
  const { data: role } = await svc
    .from("roles")
    .insert({
      organization_id: orgId,
      name: "admin",
      description: "Administrateur",
    })
    .select("id")
    .single();

  // ── 5. Create membership ────────────────────────────────────────────────────
  await svc.from("organization_members").insert({
    organization_id: orgId,
    user_id: userId,
    role_id: role?.id ?? null,
    status: "active",
  });

  // ── 6. Update profile with default_organization_id ──────────────────────────
  try {
    await svc.from("profiles").update({ default_organization_id: orgId }).eq("id", userId);
  } catch {
    // column may not exist yet
  }

  // ── 7. Upsert company_settings ──────────────────────────────────────────────
  await svc.from("company_settings").upsert({
    organization_id: orgId,
    legal_name: raisonSociale,
    ice: ice || null,
    city: ville || null,
    address: adresse || null,
    phone: tel || null,
    email: emailEnt || null,
    secteur: secteur || null,
    taille: taille || null,
    currency: "MAD",
  }, { onConflict: "organization_id" });

  // ── 8. Upload logo ──────────────────────────────────────────────────────────
  let logoUrl: string | null = null;
  let logoPath: string | null = null;

  if (logoFile && logoFile.size > 0) {
    const ext = logoFile.name.split(".").pop() ?? "png";
    logoPath = `organization-logos/${orgId}/logo.${ext}`;

    // Ensure bucket exists
    const { data: buckets } = await svc.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === "organization-logos");
    if (!bucketExists) {
      await svc.storage.createBucket("organization-logos", {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/png", "image/jpg", "image/jpeg", "image/webp"],
      });
    }

    const { error: uploadErr } = await svc.storage
      .from("organization-logos")
      .upload(logoPath, logoFile, {
        contentType: logoFile.type,
        upsert: true,
      });

    if (!uploadErr) {
      const { data: pubUrl } = svc.storage
        .from("organization-logos")
        .getPublicUrl(logoPath);
      logoUrl = pubUrl?.publicUrl ?? null;
    } else {
      console.error("registerCompany: logo upload error", uploadErr.message);
    }

    // Update org and company_settings with logo
    if (logoUrl || logoPath) {
      await svc.from("organizations").update({
        logo_url: logoUrl,
        logo_path: logoPath,
      }).eq("id", orgId);

      await svc.from("company_settings").update({
        logo_url: logoUrl,
        logo_path: logoPath,
      }).eq("organization_id", orgId);
    }
  }

  // ── 9. Initialize organization defaults ─────────────────────────────────────
  await initializeOrganizationDefaults(orgId);

  // ── 10. Start Business trial by default ─────────────────────────────────────
  const trialStart = new Date();
  const trialEnd = new Date(trialStart.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const plan = getPlanDefinition(DEFAULT_PLAN_CODE);
  const { data: businessPlan } = await svc
    .from("subscription_plans")
    .select("id")
    .eq("code", DEFAULT_PLAN_CODE)
    .maybeSingle();

  await svc.from("organization_subscriptions").upsert({
    organization_id: orgId,
    plan_id: businessPlan?.id ?? null,
    plan_code: DEFAULT_PLAN_CODE,
    status: "trialing",
    billing_cycle: "monthly",
    billing_interval: "monthly",
    trial_start: trialStart.toISOString(),
    trial_end: trialEnd.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    current_period_start: trialStart.toISOString(),
    current_period_end: trialEnd.toISOString(),
    cancel_at_period_end: false,
    selected_modules: JSON.parse(JSON.stringify(getEnabledModulesForPlan(DEFAULT_PLAN_CODE))),
    monthly_amount: plan.monthlyPrice,
    yearly_amount: plan.yearlyPrice,
  }, { onConflict: "organization_id" });

  // ── 11. Redirect to welcome guide ───────────────────────────────────────────
  redirect("/bienvenue");
}
