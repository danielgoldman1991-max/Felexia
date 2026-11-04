/** True when a Supabase auth session cookie is present. Ignores the PKCE verifier cookie. */
export function hasAuthSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)sb-[A-Za-z0-9]+-auth-token(?:\.\d+)?=/.test(cookieHeader);
}
