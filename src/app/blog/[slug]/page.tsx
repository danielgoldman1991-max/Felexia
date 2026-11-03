import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/marketing/BlogArticle";
import { BLOG_ARTICLES, getBlogArticle } from "@/lib/content/blog";
import { createPublicMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = getBlogArticle((await params).slug);
  if (!article) return {};
  return createPublicMetadata({
    title: article.title,
    description: article.description,
    path: article.path,
    image: { path: article.cover.webp, width: article.cover.width, height: article.cover.height, alt: article.cover.alt },
    article: { publishedAt: article.publishedAt, updatedAt: article.updatedAt, author: article.author },
  });
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getBlogArticle((await params).slug);
  if (!article) notFound();
  return <BlogArticle article={article} />;
}
