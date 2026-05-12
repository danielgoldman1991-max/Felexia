import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const workspace = await requireActiveWorkspace();

  const isFreeOrActive =
    workspace.subscription?.status === "active" ||
    workspace.subscription?.planSlug === "starter";

  if (!workspace.subscription) {
    redirect("/onboarding/formule");
  }

  if (!isFreeOrActive && workspace.subscription?.status === "incomplete") {
    redirect("/onboarding/paiement");
  }

  return <>{children}</>;
}
