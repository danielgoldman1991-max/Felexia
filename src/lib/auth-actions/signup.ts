"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/auth";

export type SignUpState = {
  error: string | null;
};

export async function signUpAction(
  _previousState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  if (!hasSupabaseConfig()) {
    return { error: "Configuration Supabase manquante." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || !password || !fullName) {
    return { error: "Tous les champs sont obligatoires." };
  }

  if (password.length < 6) {
    return { error: "Le mot de passe doit faire au moins 6 caracteres." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Impossible d'initialiser la connexion." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/onboarding/entreprise");
}
