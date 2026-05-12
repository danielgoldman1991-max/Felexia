import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { retrieveCheckoutSession } from "@/lib/stripe";

export default async function BillingCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; session_id?: string; canceled?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  if (params.canceled) {
    redirect("/onboarding/formule");
  }

  if (params.success && params.session_id) {
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.sub)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership) {
      redirect("/onboarding/inscription");
    }

    try {
      const session = await retrieveCheckoutSession(params.session_id);
      if (session.status === "complete") {
        redirect("/dashboard");
      }
    } catch {
      // Fall through to show the waiting page
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <Card className="w-full max-w-md text-center shadow-[var(--shadow-md)]">
        <CardHeader>
          <div className="mb-3 flex justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
              <Logo size={40} />
            </span>
          </div>
          <h1 className="text-2xl font-semibold">Finalisation de votre abonnement</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Votre paiement est en cours de traitement. Vous allez etre redirige automatiquement vers votre tableau de bord.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-blue-600" />
          </div>
          <a
            href="/dashboard"
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Acceder au tableau de bord
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
