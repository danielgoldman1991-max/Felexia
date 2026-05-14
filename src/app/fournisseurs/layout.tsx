import { ModuleGuardLayout } from "@/components/erp/module-guard-layout";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <ModuleGuardLayout moduleKey="purchases">{children}</ModuleGuardLayout>;
}