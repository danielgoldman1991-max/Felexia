import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeInternalPath } from "@/lib/auth/sanitize-internal-path";

/**
 * Détermine la destination après authentification (email ou Google).
 *
 * Ordre de résolution :
 * - A. aucune organisation active → `/onboarding/entreprise`
 *      (sauf si `next` pointe déjà vers une route d'onboarding) ;
 * - B. organisation active → `next` s'il est interne et autorisé, sinon
 *      `/dashboard`.
 *
 * Ne crée JAMAIS d'organisation, d'abonnement ou de membership ici :
 * le plan Essentiel est créé uniquement par `createEntrepriseAction`.
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

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const hasOrganization = Boolean(membership?.organization_id);

  if (!hasOrganization) {
    if (next.startsWith("/onboarding/")) {
      return next;
    }
    return "/onboarding/entreprise";
  }

  // Utilisateur déjà membre : on respecte `next` s'il est interne et ne
  // pointe pas vers un écran d'authentification ou d'onboarding.
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
