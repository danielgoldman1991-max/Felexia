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
];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getProductGuide(slug: string): ProductGuide | undefined {
  if (!SLUG.test(slug)) return undefined;
  return PRODUCT_GUIDES.find((guide) => guide.slug === slug);
}

export function guideSource(slug: string): string {
  return `guide:${slug}`;
}
