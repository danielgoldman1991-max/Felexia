"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { ActiveWorkspace } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { isOperatorRole } from "@/lib/auth/operator-access";
import Link from "next/link";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

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
  const roleReadOnly = isReadOnlyRole(workspace.role);
  const subscriptionReadOnly = !canWriteWorkspaceSubscription(workspace.subscription);
  const readOnly = roleReadOnly || subscriptionReadOnly;
  const operator = isOperatorRole(workspace.role);

  return (
    <div className="felexia-app min-h-screen max-w-full overflow-x-clip bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        workspace={workspace}
        showWelcomeGuide={!readOnly && !operator && showWelcomeGuide}
        fullAccess={fullAccess}
      />

      <div className="min-h-screen min-w-0 max-w-full overflow-x-clip transition-[padding] duration-300 lg:pl-[272px]">
        <Topbar onOpenMenu={() => setMobileOpen(true)} fullAccess={fullAccess && !operator} readOnly={readOnly} operator={operator} />
        <main className="app-content mx-auto min-w-0 w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="page-shell">
            {readOnly ? (
              <p role="status" className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm leading-6 text-[var(--muted)]">
                <strong className="font-semibold text-[var(--foreground)]">{roleReadOnly ? "Accès en lecture seule." : "Accès en consultation."}</strong>{" "}
                {roleReadOnly
                  ? "Vous pouvez consulter les données de votre entreprise. Pour les modifier, contactez votre administrateur."
                  : "Votre essai ou abonnement doit être renouvelé pour enregistrer des opérations. Vos documents et exports restent accessibles."}
                {subscriptionReadOnly && !roleReadOnly && !operator ? <> <Link className="font-semibold text-[var(--primary)] underline underline-offset-4" href="/parametres/abonnement">Gérer mon abonnement</Link></> : null}
              </p>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
