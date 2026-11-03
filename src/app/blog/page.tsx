import type { Metadata } from "next";
import { BlogIndex } from "@/components/marketing/BlogIndex";
import { BLOG_PILLARS, type BlogPillarSlug } from "@/lib/content/blog/types";
import { createPublicMetadata } from "@/lib/seo";

const title = "Guides du logiciel de gestion pour PME au Maroc | Felexia";
const description = "Guides FelexiaERP pour les PME au Maroc : mentions d’une facture, choix entre ESSENTIEL et PRO, gestion de stock. Sources indiquées, sans chiffre inventé.";

export const metadata: Metadata = createPublicMetadata({ title, description, path: "/blog" });

export default async function BlogIndexPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  const category = BLOG_PILLARS.some((pillar) => pillar.slug === categorie) ? categorie as BlogPillarSlug : undefined;
  return <BlogIndex category={category} />;
}
