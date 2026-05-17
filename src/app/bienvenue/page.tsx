import { Logo } from "@/components/brand/Logo";
import { WelcomeChecklist } from "@/components/onboarding/welcome-checklist";
import { requireActiveWorkspace } from "@/lib/auth";
import { getOnboardingChecklist } from "@/lib/onboarding";

export default async function WelcomePage() {
  const workspace = await requireActiveWorkspace();
  const checklist = await getOnboardingChecklist(workspace.organization.id);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto mb-8 flex max-w-4xl items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <Logo size={30} />
        </span>
        <div>
          <p className="font-semibold text-slate-950">Felexia</p>
          <p className="text-xs text-slate-500">Configuration guidée</p>
        </div>
      </div>
      <WelcomeChecklist checklist={checklist} />
    </main>
  );
}
