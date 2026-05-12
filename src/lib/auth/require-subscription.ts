import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";

export async function requireActiveSubscription() {
  const workspace = await requireActiveWorkspace();

  if (!workspace.subscription) {
    redirect("/onboarding/formule");
  }

  if (workspace.subscription.status === "incomplete" || workspace.subscription.status === "unpaid") {
    redirect("/onboarding/paiement");
  }

  if (workspace.subscription.status === "canceled" || workspace.subscription.status === "past_due") {
    redirect("/parametres/abonnement");
  }

  return workspace;
}
