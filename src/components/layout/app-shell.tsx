import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireActiveWorkspace } from "@/lib/auth";

export async function AppShell({ children }: { children: ReactNode }) {
  const workspace = await requireActiveWorkspace();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar workspace={workspace} />
          <main className="mx-auto w-full max-w-7xl px-5 py-7 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
