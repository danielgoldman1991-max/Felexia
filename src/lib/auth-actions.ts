"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, hasSupabaseConfig } from "@/lib/auth";
import { getUserOnboardingStatus } from "@/lib/saas";
import { getCompanyOnboardingPath, getPostOnboardingPath } from "@/lib/auth/onboarding-continuation";

export type LoginState = {
  error: string | null;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!hasSupabaseConfig()) {
    return {
      error:
        "Configuration Supabase manquante. Verifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const safeNext = getPostOnboardingPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Veuillez saisir votre email et votre mot de passe." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Impossible d'initialiser la connexion. Veuillez reessayer." };
  }

  let signInError;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    signInError = error;
  } catch {
    return {
      error:
        "Impossible de contacter le serveur d'authentification. Verifiez votre connexion internet et reessayez.",
    };
  }

  if (signInError) {
    console.error("[auth] password sign-in failed", {
      code: signInError.code,
      status: signInError.status,
      message: signInError.message,
    });
    return { error: "Email ou mot de passe incorrect." };
  }

  try {
    await getActiveWorkspace();
  } catch {
    await supabase.auth.signOut();
    return {
      error:
        "Erreur lors de la verification de votre compte. Veuillez reessayer.",
    };
  }

  const status = await getUserOnboardingStatus();
  if (!status.hasOrganization) {
    redirect(getCompanyOnboardingPath(safeNext));
  }
  if (safeNext !== "/dashboard") {
    redirect(safeNext);
  }
  redirect(status.nextPath);
}

export async function logoutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("La déconnexion n'a pas pu être confirmée. Réessayez dans quelques instants.");
  redirect("/login");
}
