"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileFromAuthUser } from "@/lib/auth/ensure-profile-from-auth-user";
import { getCompanyOnboardingPath } from "@/lib/auth/onboarding-continuation";
import { getAppUrl } from "@/lib/app-url";

export type RegisterAdminState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
  success?: string;
};

export async function registerAdminAction(
  _previousState: RegisterAdminState,
  formData: FormData,
): Promise<RegisterAdminState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: Record<string, string> = {};

  if (!firstName) fieldErrors.firstName = "Prénom requis";
  if (!lastName) fieldErrors.lastName = "Nom requis";
  if (!email || !email.includes("@")) fieldErrors.email = "Email valide requis";
  if (!password || password.length < 8) fieldErrors.password = "Minimum 8 caractères";
  if (!confirmPassword) fieldErrors.confirmPassword = "Veuillez confirmer le mot de passe.";
  if (password && confirmPassword && password !== confirmPassword) {
    fieldErrors.confirmPassword = "Les mots de passe ne correspondent pas.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Veuillez corriger les champs en erreur.", fieldErrors };
  }

  const supabase = await createClient();
  const onboardingPath = getCompanyOnboardingPath(String(formData.get("next") ?? ""));
  const callback = new URL("/auth/callback", getAppUrl());
  callback.searchParams.set("next", onboardingPath);

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callback.toString(),
      data: {
        full_name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  if (!authData.user) {
    return { error: "Impossible de créer le compte utilisateur." };
  }

  // Forcer la connexion pour garantir que la session est dans les cookies
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.user) {
    return {
      success: "Compte créé. Veuillez confirmer votre email pour continuer la configuration de votre entreprise.",
      error: null,
    };
  }

  const profileResult = await ensureProfileFromAuthUser(supabase, signInData.user);

  if (!profileResult.ok) {
    return { error: "Votre compte a été créé, mais le profil n’a pas pu être initialisé. Veuillez réessayer." };
  }

  redirect(onboardingPath);
}
