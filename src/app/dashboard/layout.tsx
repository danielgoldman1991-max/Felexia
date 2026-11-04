import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { moduleAccessError } from "@/lib/auth/module-permission";
import { getUserOnboardingStatus } from "@/lib/saas";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const status = await getUserOnboardingStatus();

  if (
    status.nextPath !== "/dashboard" &&
    status.nextPath !== "/bienvenue" &&
    status.nextPath !== "/dashboard?trial_started=1"
  ) {
    redirect(status.nextPath);
  }

  const workspace = await requireActiveWorkspace();
  const denied = await moduleAccessError(workspace, "dashboard", "read");
  if (denied) return <p className="p-8 text-sm">{denied}</p>;

  return <>{children}</>;
}
