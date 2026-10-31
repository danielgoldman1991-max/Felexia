export type InvitationPreview = { id: string; email: string; status: string; expires_at: string };

/** Session fragments from Supabase's invitation emails must be handled
 * explicitly: the shared SSR client otherwise expects a PKCE callback. */
export function invitationFragmentSession(hash: string): { access_token: string; refresh_token: string } | null {
  const values = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = values.get("access_token");
  const refreshToken = values.get("refresh_token");
  if (values.has("error") || !accessToken || !refreshToken) return null;
  return { access_token: accessToken, refresh_token: refreshToken };
}

/** Remove one-time credentials from the address bar before navigating. */
export function cleanInvitationCallbackUrl(href: string): string {
  const url = new URL(href);
  url.hash = "";
  for (const key of ["token_hash", "code", "type", "error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  return `${url.pathname}${url.search}`;
}
