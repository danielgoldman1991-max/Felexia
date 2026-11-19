import type { MetadataRoute } from "next";
import { BLOG_ARTICLES } from "@/lib/content/blog";
import { PUBLIC_SITE_PATHS } from "@/lib/public-site";
import { canonicalUrl, SEO_CONTENT_UPDATED_AT } from "@/lib/seo";

function contentDate(path: string): string {
  const article = BLOG_ARTICLES.find((item) => item.path === path);
  if (article) return article.updatedAt;
  return SEO_CONTENT_UPDATED_AT;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITE_PATHS.map((path) => ({
    url: canonicalUrl(path),
    // Content date, not the build/crawler access time.
    lastModified: contentDate(path),
  }));
}
