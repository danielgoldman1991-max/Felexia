"use server";

import { redirect } from "next/navigation";
import { startDefaultTrial } from "@/lib/saas";

export async function startTrialAction(_prev: { error: string | null } | null, formData: FormData) {
  void _prev;
  const organizationId = formData.get("organizationId") as string;

  if (!organizationId) {
    return { error: "Organization ID requis" };
  }

  await startDefaultTrial(organizationId);

  redirect("/dashboard?trial_started=1");
}
