"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace, hasSupabaseConfig } from "@/lib/auth";
import { getUserOnboardingStatus } from "@/lib/saas";

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
        "Configuration Supabase manquante. Verifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedNext = String(formData.get("next") ?? "").trim();
  const safeNext = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "";

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
  if (safeNext) {
    redirect(safeNext);
  }
  redirect(status.nextPath);
}

export async function logoutAction() {
  if (hasSupabaseConfig()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Continue even if signOut fails
    }
  }

  redirect("/login");
}
