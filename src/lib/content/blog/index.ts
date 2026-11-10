import choisir from "@/lib/content/blog/articles/choisir-entre-essentiel-et-pro";
import etatDesLieux from "@/lib/content/blog/articles/facturation-electronique-maroc-etat-des-lieux";
import stock from "@/lib/content/blog/articles/gestion-de-stock-au-maroc";
import mentions from "@/lib/content/blog/articles/mentions-obligatoires-facture-maroc";
import modeleFacture from "@/lib/content/blog/articles/modele-facture-maroc-ice";
import plf2027 from "@/lib/content/blog/articles/plf-2027-pme-maroc";
import { BLOG_PILLARS, type BlogArticle, type BlogPillarSlug } from "@/lib/content/blog/types";

export const BLOG_ARTICLES: readonly BlogArticle[] = [plf2027, modeleFacture, etatDesLieux, mentions, choisir, stock];

export function getBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((article) => article.slug === slug);
}

export function blogCategoryLabel(slug: BlogPillarSlug): string {
  return BLOG_PILLARS.find((pillar) => pillar.slug === slug)?.label ?? slug;
}

export function articlesInCategory(slug: BlogPillarSlug): BlogArticle[] {
  return BLOG_ARTICLES.filter((article) => article.category === slug);
}
