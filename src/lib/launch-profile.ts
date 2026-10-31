/** Shared presentation policy. Subscription entitlements remain independent. */
export const isLightLaunch = true;

const LIGHT_ROOTS = [
  "/dashboard", "/bienvenue", "/parametres", "/articles",
  "/facturation/factures", "/facturation/paiements", "/facturation/avoirs",
  "/achats/factures", "/achats/fournisseurs", "/achats/paiements", "/achats/avoirs",
  "/tresorerie/comptes", "/tresorerie/mouvements", "/tresorerie/consultation",
  "/comptabilite/journaux", "/comptabilite/ecritures",
  "/tiers/clients", "/tiers/fournisseurs", "/tiers/new",
] as const;

const LIGHT_REDIRECTS: Record<string, string> = {
  "/vente": "/facturation/factures",
  "/ventes": "/facturation/factures",
  "/facturation": "/facturation/factures",
  "/achats": "/achats/factures",
  "/commerce": "/facturation/factures",
  "/comptabilite": "/comptabilite/journaux",
  "/tiers": "/tiers/clients",
};

function internalPath(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return null;
  try {
    const url = new URL(href, "https://felexia.internal");
    if (url.origin !== "https://felexia.internal") return null;
    return decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

export function isLaunchPathAvailable(href: string, fullAccess = false): boolean {
  const path = internalPath(href);
  if (!path) return false;
  if (fullAccess) return true;
  if (path === "/tiers/new" && new URL(href, "https://felexia.internal").searchParams.get("type") === "prospect") return false;
  if (["/", "/login", "/pricing", "/tresorerie", "/mentions-legales", "/conditions", "/confidentialite"].includes(path)) return true;
  if (path === "/onboarding" || path.startsWith("/onboarding/") || path.startsWith("/auth/") || path.startsWith("/invitation")) return true;
  if (LIGHT_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))) return true;
  // Individual client/supplier records are shared by the two lists.
  return /^\/tiers\/[0-9a-f-]{36}(?:\/edit)?$/i.test(path);
}

/** Canonical entry for legacy hubs; other advanced screens open the request page. */
export function getLaunchDestination(href: string, fullAccess = false): string | null {
  if (fullAccess) return null;
  const path = internalPath(href);
  if (path && LIGHT_REDIRECTS[path]) return LIGHT_REDIRECTS[path];
  const aliases: Record<string, string> = {
    "/factures": "/facturation/factures", "/paiements": "/facturation/paiements",
    "/avoirs": "/facturation/avoirs", "/clients": "/tiers/clients",
    "/fournisseurs": "/tiers/fournisseurs",
  };
  for (const [alias, destination] of Object.entries(aliases)) {
    if (path === alias || path?.startsWith(`${alias}/`)) return `${destination}${path.slice(alias.length)}`;
  }
  return isLaunchPathAvailable(href) ? null : "/parametres/modules";
}
