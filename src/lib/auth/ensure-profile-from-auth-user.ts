import type { SupabaseClient, User } from "@supabase/supabase-js";

export type EnsureProfileResult =
  | { ok: true }
  | { ok: false; reason: "conflict" | "error"; message?: string };

type AuthMeta = Record<string, unknown>;

function firstString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Extrait les données Google du `user_metadata` Supabase.
 * (Google fournit : full_name / name / given_name / family_name / picture)
 */
export function extractGoogleProfileData(user: User): {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
} {
  const meta = (user.user_metadata ?? {}) as AuthMeta;

  const fullName = firstString(meta.full_name) ?? firstString(meta.name);
  const givenName = firstString(meta.given_name) ?? firstString(meta.first_name);
  const familyName = firstString(meta.family_name) ?? firstString(meta.last_name);

  // Segmentation du nom complet en dernier recours
  let firstName = givenName;
  let lastName = familyName;
  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      firstName = parts[0];
      lastName = parts.slice(1).join(" ");
    } else {
      firstName = fullName;
    }
  }

  return {
    fullName,
    firstName,
    lastName,
    avatarUrl: firstString(meta.avatar_url) ?? firstString(meta.picture),
  };
}

/**
 * Synchronise le profil métier depuis l'utilisateur Supabase (Google ou email).
 *
 * Règles :
 * - crée le profil si absent (upsert sur `profiles.id` = auth user id) ;
 * - ne met à jour QUE les champs vides (jamais d'écrasement de données
 *   modifiées manuellement) ;
 * - conserve l'organisation active inchangée (aucun toucher sur les
 *   organisations/memberships) ;
 * - si un AUTRE profil existe avec le même email (conflit d'identité),
 *   ne fusionne rien : retourne `conflict` pour afficher une erreur propre.
 *
 * Ne crée ni organisation, ni abonnement, ni membership.
 */
export async function ensureProfileFromAuthUser(
  supabase: SupabaseClient,
  user: User,
): Promise<EnsureProfileResult> {
  const email = (user.email ?? "").trim().toLowerCase();

  if (!user.id) {
    return { ok: false, reason: "error", message: "Utilisateur invalide." };
  }

  // 1. Conflit d'identité : un autre profil possède déjà cet email.
  if (email) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .neq("id", user.id)
      .ilike("email", email)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        ok: false,
        reason: "conflict",
        message:
          "Un profil existe déjà pour cet email. La fusion automatique n'est pas autorisée.",
      };
    }
  }

  const { fullName, firstName, lastName, avatarUrl } = extractGoogleProfileData(user);

  // 2. Upsert via le RPC `ensure_user_profile` (security definer, fill-only-empty).
  const { error: rpcError } = await supabase.rpc("ensure_user_profile", {
    p_full_name: fullName,
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
    p_avatar_url: avatarUrl,
  });

  if (rpcError) {
    // Fallback (migration 091 non appliquée) : remplissage champs vides en direct.
    const { data: current } = await supabase
      .from("profiles")
      .select("id,full_name,first_name,last_name,avatar_url,email")
      .eq("id", user.id)
      .maybeSingle();

    const patch: Record<string, string | null | undefined> = {};
    if (email && !current?.email) patch.email = email;
    if (fullName && !current?.full_name) patch.full_name = fullName;
    if (firstName && !current?.first_name) patch.first_name = firstName;
    if (lastName && !current?.last_name) patch.last_name = lastName;
    if (avatarUrl && !current?.avatar_url) patch.avatar_url = avatarUrl;

    if (current && Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id);
      if (updateError) {
        return { ok: false, reason: "error", message: updateError.message };
      }
    }

    if (!current) {
      const { error: insertError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          avatar_url: avatarUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (insertError) {
        return { ok: false, reason: "error", message: insertError.message };
      }
    }
  }

  return { ok: true };
}
