import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuidePage } from "@/components/marketing/GuidePage";
import { ARTICLES, getArticle } from "@/lib/content/guides";
import { createPublicMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug ?? "" }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = getArticle((await params).slug);
  if (!article) return {};
  return createPublicMetadata({ title: article.title, description: article.description, path: article.path });
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getArticle((await params).slug);
  if (!article) notFound();
  return <GuidePage guide={article} />;
}
