import type { Metadata } from "next";
import { BlogIndex } from "@/components/marketing/BlogIndex";
import { BLOG_PILLARS, type BlogPillarSlug } from "@/lib/content/blog/types";
import { createPublicMetadata } from "@/lib/seo";

const title = "Articles gestion et facturation Maroc | Felexia";
const description = "Articles sourcés pour PME au Maroc : facturation, ICE, déclaration TVA SIMPL-TVA, stock et facture électronique. À jour, sans chiffres inventés.";

export const metadata: Metadata = createPublicMetadata({ title, description, path: "/blog" });

export default async function BlogIndexPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  const category = BLOG_PILLARS.some((pillar) => pillar.slug === categorie) ? categorie as BlogPillarSlug : undefined;
  return <BlogIndex category={category} />;
}
