"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { ActiveWorkspace } from "@/lib/auth";

export function AppShellClient({
  children,
  workspace,
  showWelcomeGuide,
}: {
  children: ReactNode;
  workspace: ActiveWorkspace;
  showWelcomeGuide: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        workspace={workspace}
        showWelcomeGuide={showWelcomeGuide}
      />

      <div className="min-h-screen transition-[padding] duration-300 lg:pl-[288px]">
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="page-shell">{children}</div>
        </main>
      </div>
    </div>
  );
}
