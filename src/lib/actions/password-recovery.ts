"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { canCompletePasswordRecovery, clearPasswordRecovery } from "@/lib/auth/recovery-session";

export type PasswordRecoveryState = { error: string | null; sent?: boolean };

export async function requestPasswordRecovery(_state: PasswordRecoveryState, formData: FormData): Promise<PasswordRecoveryState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { error: "Saisissez une adresse email valide." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppUrl()}/auth/callback?recovery=1`,
    });
    if (error) {
      console.error("[password-recovery] dispatch failed", { code: error.code });
      return { error: error.status === 429 ? "Patientez quelques instants avant de demander un nouveau lien." : "Le mail n'a pas pu être envoyé. Réessayez dans quelques instants ou contactez l'assistance." };
    }
    // Same result for known and unknown addresses: no account enumeration.
    return { error: null, sent: true };
  } catch { return { error: "La récupération est momentanément indisponible. Réessayez dans quelques instants." }; }
}

export async function completePasswordRecovery(_state: PasswordRecoveryState, formData: FormData): Promise<PasswordRecoveryState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 12 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return { error: "Choisissez un mot de passe de 12 à 128 caractères, avec au moins une lettre et un chiffre." };
  if (password !== confirmation) return { error: "Les deux mots de passe doivent être identiques." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !await canCompletePasswordRecovery(user.id)) return { error: "Ce lien a expiré. Demandez un nouveau lien de récupération." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? "Choisissez un mot de passe différent du précédent." : "Le mot de passe n'a pas pu être enregistré. Réessayez ou demandez un nouveau lien." };
  await clearPasswordRecovery();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?notice=password_updated");
}
