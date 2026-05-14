"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function startTrialAction(prev: { error: string | null } | null, formData: FormData) {
  const organizationId = formData.get("organizationId") as string;
  const selectedModulesRaw = formData.get("selectedModules") as string;
  const billingInterval = formData.get("billingInterval") as "monthly" | "yearly";

  if (!organizationId) {
    return { error: "Organization ID requis" };
  }

  if (!selectedModulesRaw) {
    return { error: "Sélectionnez au moins un module" };
  }

  const selectedModules: string[] = JSON.parse(selectedModulesRaw);
  const supabase = await createClient();

  const { data: catalog } = await supabase
    .from("modules_catalog")
    .select("*")
    .eq("is_active", true);

  if (!catalog) {
    return { error: "Erreur de chargement du catalogue" };
  }

  const monthlyAmount = catalog
    .filter((m) => selectedModules.includes(m.module_key))
    .reduce((sum, m) => sum + Number(m.monthly_price), 0);

  const yearlyAmount = catalog
    .filter((m) => selectedModules.includes(m.module_key))
    .reduce((sum, m) => sum + Number(m.yearly_price), 0);

  const trialStart = new Date().toISOString();
  const trialEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  const moduleRows = selectedModules.map((key) => ({
    organization_id: organizationId,
    module_key: key,
    enabled: true,
  }));

  const { error: modulesError } = await supabase
    .from("organization_modules")
    .upsert(moduleRows, { onConflict: "organization_id, module_key" });

  if (modulesError) {
    return { error: `Erreur activation modules: ${modulesError.message}` };
  }

  // Check if a subscription already exists
  const { data: existingSub } = await supabase
    .from("organization_subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const subscriptionPayload = {
    organization_id: organizationId,
    status: "trialing" as const,
    trial_start: trialStart,
    trial_end: trialEnd,
    billing_interval: billingInterval,
    monthly_amount: monthlyAmount,
    yearly_amount: yearlyAmount,
    selected_modules: JSON.parse(JSON.stringify(selectedModules)),
  };

  if (existingSub) {
    const { error: updateError } = await supabase
      .from("organization_subscriptions")
      .update(subscriptionPayload)
      .eq("id", existingSub.id);

    if (updateError) {
      return { error: `Erreur mise à jour abonnement: ${updateError.message}` };
    }
  } else {
    const { error: insertError } = await supabase
      .from("organization_subscriptions")
      .insert(subscriptionPayload);

    if (insertError) {
      return { error: `Erreur création abonnement: ${insertError.message}` };
    }
  }

  redirect("/onboarding/paiement");
}
