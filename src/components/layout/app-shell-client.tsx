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
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        workspace={workspace}
        showWelcomeGuide={showWelcomeGuide}
      />

      <div className="min-h-screen transition-[padding] duration-300 lg:pl-[300px]">
        <Topbar workspace={workspace} onOpenMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
