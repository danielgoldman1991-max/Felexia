// Route orpheline conservée pour compatibilité. Il n'existe plus de choix de
// plan : seule l'offre Essentiel est commercialisée. Un utilisateur connecté
// est redirigé vers son abonnement ; sinon vers la connexion.
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
