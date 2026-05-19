import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SubscriptionChoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) {
    redirect("/onboarding/entreprise");
  }

  await supabase
    .from("organizations")
    .update({
      onboarding_step: "completed",
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.organization_id);

  redirect("/dashboard");
}
