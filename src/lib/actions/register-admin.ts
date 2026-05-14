"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@/lib/supabase/service";

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
  const phone = String(formData.get("phone") ?? "").trim();

  const fieldErrors: Record<string, string> = {};

  if (!firstName) fieldErrors.firstName = "Prénom requis";
  if (!lastName) fieldErrors.lastName = "Nom requis";
  if (!email || !email.includes("@")) fieldErrors.email = "Email valide requis";
  if (!password || password.length < 8) fieldErrors.password = "Minimum 8 caractères";

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

  await svc.from("profiles").upsert({
    id: userId,
    email,
    full_name: `${firstName} ${lastName}`,
  }, { onConflict: "id" });

  if (authData.session === null) {
    return {
      success: "Compte créé. Veuillez confirmer votre email pour continuer la configuration de votre entreprise.",
      error: null,
    };
  }

  redirect("/onboarding/entreprise");
}