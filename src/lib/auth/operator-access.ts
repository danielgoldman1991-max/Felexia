export { isOperatorRole } from "./roles";

export const OPERATOR_ACCESS_ERROR = "Ce profil Opérateur ne permet pas cette action. Contactez votre administrateur.";

function normalizedUrl(href: string): URL | null {
  if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return null;
  try {
    const url = new URL(href, "https://felexia.internal");
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== "https://felexia.internal" || path.includes("\\") || path.startsWith("//")) return null;
    url.pathname = path;
    return url;
  } catch {
    return null;
  }
}

/** Daily operations within the active company. Database policies enforce writes. */
export function isOperatorPathAllowed(href: string, method = "GET"): boolean {
  const url = normalizedUrl(href);
  if (!url) return false;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const read = method === "GET" || method === "HEAD";
  if (["/parametres/profil", "/parametres/preferences", "/parametres/securite"].includes(path)) return true;
  if (["/api/notifications/read", "/api/notifications/read-all"].includes(path)) return true;
  if (path === "/dashboard") return read;
  if (["/api/notifications", "/api/global-search"].includes(path)) return read;
  if (/^\/(?:facturation\/(?:factures|paiements|avoirs)|achats\/(?:factures|paiements|fournisseurs))(?:\/|$)/.test(path)) return true;
  if (["/tiers/clients", "/tiers/fournisseurs"].includes(path)) return true;
  if (path === "/tiers/new") return ["customer", "supplier", "both", null].includes(url.searchParams.get("type"));
  if (/^\/tiers\/[0-9a-f-]{36}(?:\/edit)?$/i.test(path)) return true;
  if (!read) return false;
  if (path === "/tresorerie" || path === "/tresorerie/consultation") return true;
  if (/^\/tresorerie\/(?:comptes|mouvements)(?:\/[0-9a-f-]{36}(?:\/print)?)?$/i.test(path)) return true;
  if (/^\/comptabilite\/(?:journaux|ecritures)(?:\/[0-9a-f-]{36}(?:\/(?:print|export))?)?$/i.test(path)) return true;
  return false;
}

export function getOperatorDestination(href: string): string | null {
  if (isOperatorPathAllowed(href)) return null;
  return normalizedUrl(href)?.pathname.replace(/\/+$/, "") === "/parametres" ? "/parametres/profil" : "/dashboard";
}
