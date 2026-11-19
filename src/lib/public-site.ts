/** Public marketing routes only. Safe to import from server or client code. */
export const PUBLIC_SITE_ORIGIN = "https://www.felexia.pro";

export const PUBLIC_SITE_PATHS = [
  "/",
  "/essentiel",
  "/pro",
  "/pricing",
  "/logiciel-facturation-maroc",
  "/facturation-electronique-maroc",
  "/declaration-tva-maroc",
  "/logiciel-comptabilite-maroc",
  "/logiciel-paie-maroc",
  "/logiciel-gestion-stock-maroc",
  "/logiciel-devis-facture-maroc",
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
  "/blog/retenue-source-auto-entrepreneur-plf-2027",
  "/blog/ice-facture-maroc",
  "/blog/erp-maroc-pme",
  "/blog/avoir-facture-maroc",
  "/blog/numerotation-facture-maroc",
  "/blog/declaration-tva-export-simpl",
  "/blog/tva-encaissement-ou-debits-maroc",
  "/blog/deposer-declaration-tva-simpl",
  "/blog/if-ice-rc-tp-facture-maroc",
  "/blog/facture-acompte-maroc",
  "/blog/facture-proforma-vs-facture-maroc",
  "/blog/devis-bon-commande-livraison-facture-maroc",
  "/blog/facture-excel-ou-logiciel-maroc",
  "/blog/paie-cnss-amo-ir-maroc",
  "/blog/fichier-damancom-dns-bds",
  "/blog/etat-9421-traitements-salaires",
  "/blog/bulletin-paie-maroc-mentions",
  "/blog/journaux-comptables-pme-maroc",
  "/blog/export-comptable-fiduciaire-maroc",
  "/blog/modes-paiement-facture-maroc",
  "/blog/calendrier-fiscal-pme-maroc",
  "/blog/credit-tva-remboursement-maroc",
  "/blog/tva-maroc-pme",
  "/blog/relance-facture-impayee-maroc",
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
