"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: `${firstName} ${lastName}`,
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
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return {
      success: "Compte créé. Veuillez confirmer votre email pour continuer la configuration de votre entreprise.",
      error: null,
    };
  }

  const { error: profileError } = await supabase.rpc("ensure_user_profile", {
    p_full_name: `${firstName} ${lastName}`,
    p_email: email,
  });

  if (profileError) {
    return { error: "Votre compte a été créé, mais le profil n’a pas pu être initialisé. Veuillez réessayer." };
  }

  redirect("/onboarding/entreprise");
}
