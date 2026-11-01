// Legacy entry point: manage ESSENTIEL and PRO from the subscription settings.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PlanChoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/parametres/abonnement");
}
