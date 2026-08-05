"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initializeOrganizationDefaults } from "@/lib/org-defaults";

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

  // Use SECURITY DEFINER RPC to create org + profile + admin role + member atomically.
  // Direct INSERT on organizations is blocked by RLS (no INSERT policy).
  // The RPC also ensures a profiles row exists (FK target for organization_members).
  const adminName = user.user_metadata?.full_name as string | undefined;

  const { data: orgId, error: rpcError } = await supabase.rpc(
    "create_organization_with_owner",
    {
      p_name: companyName,
      p_slug: slug,
      p_admin_name: adminName ?? null,
    },
  );

  if (rpcError) {
    return { error: rpcError.message };
  }

  if (!orgId) {
    return { error: "Impossible de creer l'entreprise. Veuillez reessayer." };
  }

  await initializeOrganizationDefaults(orgId);

  redirect("/bienvenue?trial=essentiel");
}
