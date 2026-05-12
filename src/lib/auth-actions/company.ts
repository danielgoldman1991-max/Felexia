"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CompanyState = {
  error: string | null;
};

export async function createCompanyAction(
  _previousState: CompanyState,
  formData: FormData,
): Promise<CompanyState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifie." };
  }

  const companyName = String(formData.get("companyName") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase().replace(/\s+/g, "-");

  if (!companyName || !slug) {
    return { error: "Le nom et le slug sont obligatoires." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile?.full_name) {
    await supabase
      .from("profiles")
      .update({ full_name: user.user_metadata?.full_name || "", email: user.email })
      .eq("id", user.id);
  }

  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingOrg) {
    return { error: "Ce slug est deja pris. Veuillez en choisir un autre." };
  }

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: companyName, slug })
    .select("id")
    .single();

  if (orgError || !org) {
    return { error: orgError?.message || "Erreur lors de la creation de l'organisation." };
  }

  const { data: adminRole } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "admin")
    .limit(1)
    .maybeSingle();

  if (!adminRole) {
    const { data: newRole } = await supabase
      .from("roles")
      .insert({ organization_id: org.id, name: "admin", description: "Administrateur" })
      .select("id")
      .single();
    if (newRole) {
      await supabase.from("organization_members").insert({
        organization_id: org.id,
        user_id: user.id,
        role_id: newRole.id,
        status: "active",
      });
    }
  } else {
    await supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role_id: adminRole.id,
      status: "active",
    });
  }

  redirect("/onboarding/formule");
}
