import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessApp } from "@/lib/subscriptions/subscription-access";
import { startDefaultTrialAndEnableModules } from "@/lib/subscriptions/plan-access";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Utilisateur non connecté." }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error("Membership error:", membershipError);
      return NextResponse.json(
        { error: "Impossible de récupérer l'organisation de l'utilisateur." },
        { status: 500 },
      );
    }

    if (!membership?.organization_id) {
      return NextResponse.json({ error: "Aucune entreprise trouvée pour cet utilisateur." }, { status: 400 });
    }

    const organizationId = membership.organization_id;

    const { data: existingSubscription, error: subscriptionReadError } = await supabase
      .from("organization_subscriptions")
      .select("id, status, trial_ends_at, trial_end, current_period_end")
      .eq("organization_id", organizationId)
      .limit(1)
      .maybeSingle();

    if (subscriptionReadError) {
      console.error("Subscription read error:", subscriptionReadError);
      return NextResponse.json(
        { error: "Impossible de vérifier l'abonnement actuel." },
        { status: 500 },
      );
    }

    if (existingSubscription && canAccessApp({
      status: existingSubscription.status,
      trial_ends_at: existingSubscription.trial_ends_at ?? existingSubscription.trial_end ?? null,
      current_period_end: existingSubscription.current_period_end ?? null,
    })) {
      await startDefaultTrialAndEnableModules(organizationId, user.id);
      await supabase
        .from("organizations")
        .update({
          onboarding_step: "completed",
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);
      return NextResponse.json({
        success: true,
        alreadyActive: true,
        redirectTo: "/bienvenue?trial=essentiel",
        message: "Votre essai Essentiel est actif. Les modules Essentiel sont disponibles.",
      });
    }

    await startDefaultTrialAndEnableModules(organizationId, user.id);

    const { error: organizationUpdateError } = await supabase
      .from("organizations")
      .update({
        onboarding_step: "completed",
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    if (organizationUpdateError) {
      console.error("Organization update error:", organizationUpdateError);
      return NextResponse.json(
        { error: "Essai créé, mais impossible de mettre à jour l'onboarding." },
        { status: 500 },
      );
    }

    console.log("START_TRIAL_SUCCESS", {
      organizationId,
      subscriptionCreatedOrUpdated: true,
      nextOnboardingStep: "completed",
      modulesEnabled: true,
      redirectTo: "/bienvenue?trial=essentiel",
    });

    return NextResponse.json({
      success: true,
      redirectTo: "/bienvenue?trial=essentiel",
      message: "Votre essai Essentiel est actif. Les modules Essentiel sont disponibles.",
    });
  } catch (error) {
    console.error("Start trial fatal error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Erreur inconnue lors de l'activation de l'essai Essentiel.",
      },
      { status: 500 },
    );
  }
}
