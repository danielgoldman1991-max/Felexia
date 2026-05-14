import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getModulesCatalog } from "@/lib/saas";
import { OnboardingModulesClient } from "./client";

export default async function OnboardingModulesPage() {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role:roles(name)")
    .eq("user_id", user.sub)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding/entreprise");
  }

  const modules = await getModulesCatalog();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 text-center">
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-sm">
            <Logo size={40} />
          </span>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">Choisissez vos modules</h1>
          <p className="mt-2 text-slate-500">
            Sélectionnez les fonctionnalités adaptées à votre activité.
          </p>
        </div>
        <OnboardingModulesClient
          modules={modules}
          organizationId={membership.organization_id}
        />
      </div>
    </main>
  );
}
