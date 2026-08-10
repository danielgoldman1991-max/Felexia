import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeInternalPath } from "@/lib/auth/sanitize-internal-path";

/**
 * Détermine la destination après authentification (email ou Google).
 *
 * Ordre de résolution :
 * - A. aucune organisation active (ni membership actif) → `/onboarding/entreprise`
 *      (sauf si `next` pointe déjà vers une route d'onboarding) ;
 * - B. organisation active mais onboarding entreprise incomplet →
 *      `/onboarding/entreprise` ;
 * - C. organisation valide + onboarding complet → `next` s'il est interne et
 *      autorisé, sinon `/dashboard`.
 *
 * Ne crée JAMAIS d'organisation, d'abonnement ou de membership ici :
 * le plan Essentiel est créé uniquement par `createEntrepriseAction`.
 * Ne retourne JAMAIS `/dashboard` sans organisation existante et valide.
 */
export async function resolveAuthenticatedUserRedirect({
  supabase,
  userId,
  requestedNext,
}: {
  supabase: SupabaseClient;
  userId: string;
  requestedNext?: string | null;
}): Promise<string> {
  const next = sanitizeInternalPath(requestedNext ?? "/dashboard");

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("[AUTH CALLBACK]", {
      step: "membership-lookup",
      userId,
      errorMessage: membershipError.message,
    });
    return "/onboarding/entreprise";
  }

  // A. Aucun membership actif : état normal pour un nouvel utilisateur Google.
  if (!membership?.organization_id) {
    if (next.startsWith("/onboarding/")) {
      return next;
    }
    return "/onboarding/entreprise";
  }

  // B. Membership existant : on vérifie que l'organisation est réellement
  // présente et que son onboarding est complet avant /dashboard.
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, onboarding_completed")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    console.error("[AUTH CALLBACK]", {
      step: "organization-lookup",
      userId,
      organizationId: membership.organization_id,
      errorMessage: organizationError.message,
    });
    return "/onboarding/entreprise";
  }

  if (!organization || !organization.onboarding_completed) {
    return "/onboarding/entreprise";
  }

  // C. Utilisateur déjà membre d'une organisation complète : on respecte
  // `next` s'il est interne et ne pointe pas vers auth/onboarding.
  if (
    next !== "/dashboard" &&
    !next.startsWith("/login") &&
    !next.startsWith("/onboarding") &&
    !next.startsWith("/auth/")
  ) {
    return next;
  }

  return "/dashboard";
}
