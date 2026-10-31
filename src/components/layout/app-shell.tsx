import type { ReactNode } from "react";
import { AppShellClient } from "@/components/layout/app-shell-client";
import { requireActiveWorkspace } from "@/lib/auth";
import { getOnboardingChecklist, isOnboardingChecklistComplete } from "@/lib/onboarding";
import { getUserOnboardingStatus } from "@/lib/saas";
import { hasFullErpAccess } from "@/lib/launch-access";

export async function AppShell({ children }: { children: ReactNode }) {
  await getUserOnboardingStatus();
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  let showWelcomeGuide = true;

  try {
    const checklist = await getOnboardingChecklist(workspace.organization.id);
    showWelcomeGuide = !isOnboardingChecklistComplete(checklist);
  } catch {
    showWelcomeGuide = true;
  }

  return (
    <AppShellClient workspace={workspace} showWelcomeGuide={showWelcomeGuide} fullAccess={fullAccess}>
      {children}
    </AppShellClient>
  );
}
