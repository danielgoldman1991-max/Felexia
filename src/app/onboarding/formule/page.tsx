import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlanSelection } from "@/components/onboarding/plan-selection";
import { hasStripeEnv } from "@/lib/env";

export default async function PlanPage() {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role:roles(name)")
    .eq("user_id", user.sub)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding/societe");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", membership.organization_id)
    .single();

  const { data: subscription } = await supabase
    .from("organization_subscriptions")
    .select("id, status")
    .eq("organization_id", membership.organization_id)
    .limit(1)
    .maybeSingle();

  if (subscription && subscription.status === "active") {
    redirect("/dashboard");
  }

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_public", true)
    .order("sort_order");

  const stripeConfigured = hasStripeEnv();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="mb-8 text-center">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
          <Logo size={40} />
        </span>
        <h1 className="mt-4 text-3xl font-bold text-[var(--foreground)]">Choisissez votre formule</h1>
        <p className="mt-2 text-[var(--muted)]">
          Commencez gratuitement, passez a une formule superieure quand vous etes pret.
        </p>
      </div>
      <div className="w-full max-w-5xl">
        <PlanSelection
          plans={plans || []}
          organizationId={membership.organization_id}
          stripeConfigured={stripeConfigured}
        />
      </div>
    </main>
  );
}
