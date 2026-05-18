import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUserOnboardingStatus } from "@/lib/saas";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const status = await getUserOnboardingStatus();

  if (status.nextPath !== "/dashboard" && status.nextPath !== "/bienvenue") {
    redirect(status.nextPath);
  }

  return <>{children}</>;
}
