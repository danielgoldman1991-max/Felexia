"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { ActiveWorkspace } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { isOperatorRole } from "@/lib/auth/operator-access";

export function AppShellClient({
  children,
  workspace,
  showWelcomeGuide,
  fullAccess = false,
}: {
  children: ReactNode;
  workspace: ActiveWorkspace;
  showWelcomeGuide: boolean;
  fullAccess?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const readOnly = isReadOnlyRole(workspace.role);
  const operator = isOperatorRole(workspace.role);

  return (
    <div className="min-h-screen max-w-full overflow-x-clip text-[var(--foreground)]">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        workspace={workspace}
        showWelcomeGuide={!readOnly && !operator && showWelcomeGuide}
        fullAccess={fullAccess}
      />

      <div className="min-h-screen min-w-0 max-w-full overflow-x-clip transition-[padding] duration-300 lg:pl-[288px]">
        <Topbar onOpenMenu={() => setMobileOpen(true)} fullAccess={fullAccess && !operator} readOnly={readOnly} operator={operator} />
        <main className="mx-auto min-w-0 w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="page-shell">
            {readOnly ? <p role="status" className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm leading-6 text-[var(--muted)]"><strong className="font-semibold text-[var(--foreground)]">Accès en lecture seule.</strong> Vous pouvez consulter les données de votre entreprise. Pour les modifier, contactez votre administrateur.</p> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
