import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export function ModulePage({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
