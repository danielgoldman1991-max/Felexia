import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { CompanyOnboardingFlow } from "@/components/onboarding/CompanyOnboardingFlow";
import { getUserOnboardingStatus } from "@/lib/saas";
import { createClient } from "@/lib/supabase/server";

export default async function EntreprisePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding/entreprise");
  }

  const status = await getUserOnboardingStatus();

  // Not authenticated → redirect to login
  if (status.nextPath === "/login") {
    redirect("/login?next=/onboarding/entreprise");
  }

  // Already has an organization → go to correct next step
  if (status.hasOrganization) {
    redirect(status.nextPath);
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#0D1117",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#fff",
          },
        }}
      />
      <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] md:py-12">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white">
                <Logo size={34} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Felexia</p>
                <p className="text-xs text-[var(--muted)]">Configuration de votre entreprise</p>
              </div>
            </div>
            <span className="hidden rounded-full border border-[#D6B56D]/20 bg-[#D6B56D]/10 px-3 py-1 text-xs font-medium text-[#D6B56D] sm:inline-flex">
              Business spécial lancement
            </span>
          </div>

          <CompanyOnboardingFlow initialEmail={user.email ?? ""} />
        </div>
      </main>
    </>
  );
}
