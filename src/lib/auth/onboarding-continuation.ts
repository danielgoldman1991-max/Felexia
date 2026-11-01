import { sanitizeInternalPath } from "@/lib/auth/sanitize-internal-path";

/** Keep a requested screen through company setup, without auth/onboarding loops. */
export function getPostOnboardingPath(requestedNext?: string | null): string {
  let next = sanitizeInternalPath(requestedNext);
  for (let depth = 0; depth < 3; depth++) {
    const url = new URL(next, "https://felexia.internal");
    if (url.pathname === "/onboarding/entreprise") {
      next = sanitizeInternalPath(url.searchParams.get("next"));
      continue;
    }
    return /^\/(?:login|auth|onboarding)(?:\/|$)/.test(url.pathname) ? "/dashboard" : next;
  }
  return "/dashboard";
}

export function getCompanyOnboardingPath(requestedNext?: string | null): string {
  const next = getPostOnboardingPath(requestedNext);
  return next === "/dashboard" ? "/onboarding/entreprise" : `/onboarding/entreprise?next=${encodeURIComponent(next)}`;
}
