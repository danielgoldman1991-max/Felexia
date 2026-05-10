import type { ReactNode } from "react";
import { AppShellClient } from "@/components/layout/app-shell-client";
import { requireActiveWorkspace } from "@/lib/auth";

export async function AppShell({ children }: { children: ReactNode }) {
  const workspace = await requireActiveWorkspace();
  return <AppShellClient workspace={workspace}>{children}</AppShellClient>;
}
