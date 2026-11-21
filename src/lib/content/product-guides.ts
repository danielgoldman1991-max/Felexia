/** Public product guides. Add an entry here to list another downloadable guide. */

export type ProductGuide = {
  slug: string;
  title: string;
  description: string;
  pages: number;
  kicker: string;
  filename: string;
  cover: { webp: string; avif: string; width: number; height: number; alt: string };
};

export const PRODUCT_GUIDES: readonly ProductGuide[] = [
  {
    slug: "pro",
    kicker: "Offre PRO",
    title: "Guide produit FelexiaERP PRO",
    description: "32 pages pour parcourir l’ERP complet : ventes, achats, stock, trésorerie, comptabilité et ressources humaines. Les montants du document sont fictifs.",
    pages: 32,
    filename: "FelexiaERP_PRO_Guide.pdf",
    cover: {
      webp: "/images/guides/felexia-pro-guide-cover.webp",
      avif: "/images/guides/felexia-pro-guide-cover.avif",
      width: 992,
      height: 1404,
      alt: "Couverture du guide produit FelexiaERP PRO, offre ERP complet pour les PME au Maroc, avec un aperçu du tableau de bord.",
    },
  },
  {
    slug: "essentiel",
    kicker: "Offre ESSENTIEL",
    title: "Guide produit FelexiaERP ESSENTIEL",
    description: "24 pages pour découvrir la facturation, les règlements, la trésorerie, les journaux, la déclaration de TVA avec l’export SIMPL-TVA, la facture électronique et les sauvegardes. Les montants du document sont fictifs.",
    pages: 24,
    filename: "FelexiaERP_ESSENTIEL_Guide.pdf",
    cover: {
      webp: "/images/guides/felexia-essentiel-guide-cover.webp",
      avif: "/images/guides/felexia-essentiel-guide-cover.avif",
      width: 992,
      height: 1404,
      alt: "Couverture du guide produit FelexiaERP ESSENTIEL, offre de facturation, règlements, journaux et TVA pour les TPE et PME au Maroc, avec un aperçu de l’accueil.",
    },
  },
  {
    slug: "declaration-tva",
    kicker: "TVA",
    title: "Tutoriel déclaration de TVA et SIMPL",
    description: "Le parcours ESSENTIEL et PRO : périodicité, fournisseurs, règlements, déclaration et relevé XML. Les exemples du PDF sont fictifs. Le dépôt SIMPL reste le vôtre.",
    pages: 22,
    filename: "FelexiaERP_Tutoriel_Declaration_TVA.pdf",
    cover: {
      webp: "/images/guides/tva-tutoriel-cover.webp",
      avif: "/images/guides/tva-tutoriel-cover.avif",
      width: 800,
      height: 1132,
      alt: "Couverture bleue du tutoriel FelexiaERP sur la déclaration de TVA et l’export SIMPL-TVA, pour ESSENTIEL et PRO.",
    },
  },
];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getProductGuide(slug: string): ProductGuide | undefined {
  if (!SLUG.test(slug)) return undefined;
  return PRODUCT_GUIDES.find((guide) => guide.slug === slug);
}

export function guideSource(slug: string): string {
  return `guide:${slug}`;
}
