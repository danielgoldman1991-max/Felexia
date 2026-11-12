/** Public marketing routes only. Safe to import from server or client code. */
export const PUBLIC_SITE_ORIGIN = "https://www.felexia.pro";

export const PUBLIC_SITE_PATHS = [
  "/",
  "/essentiel",
  "/pro",
  "/pricing",
  "/logiciel-facturation-maroc",
  "/facturation-electronique-maroc",
  "/guides",
  "/blog",
  "/blog/facturation-electronique-maroc-etat-des-lieux",
  "/blog/mentions-obligatoires-facture-maroc",
  "/blog/choisir-entre-essentiel-et-pro",
  "/blog/gestion-de-stock-au-maroc",
  "/blog/modele-facture-maroc-ice",
  "/blog/plf-2027-pme-maroc",
  "/blog/facture-auto-entrepreneur-maroc",
  "/blog/logiciel-gestion-pme-maroc",
  "/blog/facture-electronique-pdf-xml",
  "/mentions-legales",
  "/conditions",
  "/confidentialite",
] as const;

export type PublicSitePath = (typeof PUBLIC_SITE_PATHS)[number];

/** Accept a pathname, never a full URL, query, fragment or private child route. */
export function isPublicSitePath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /[\\?#]/.test(pathname)) return false;
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_SITE_PATHS.some((path) => path === normalized);
}
