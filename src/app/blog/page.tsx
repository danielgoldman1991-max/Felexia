import type { Metadata } from "next";
import { BlogIndex } from "@/components/marketing/BlogIndex";
import { BLOG_PILLARS, type BlogPillarSlug } from "@/lib/content/blog/types";
import { createPublicMetadata } from "@/lib/seo";

const title = "Guides du logiciel de gestion pour PME au Maroc | Felexia";
const description = "Facturation, stock, fiscalité : des guides pratiques et sourcés pour piloter votre PME au Maroc, avec Felexia.";

export const metadata: Metadata = createPublicMetadata({ title, description, path: "/blog" });

export default async function BlogIndexPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  const category = BLOG_PILLARS.some((pillar) => pillar.slug === categorie) ? categorie as BlogPillarSlug : undefined;
  return <BlogIndex category={category} />;
}
