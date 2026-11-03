import type { MetadataRoute } from "next";
import { PUBLIC_SITE_PATHS } from "@/lib/public-site";
import { canonicalUrl, SEO_CONTENT_UPDATED_AT } from "@/lib/seo";

const revisedPages = new Set(["/essentiel", "/pro", "/confidentialite"]);

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITE_PATHS.map((path) => ({
    url: canonicalUrl(path),
    // Content date, not the build/crawler access time.
    lastModified: revisedPages.has(path) ? "2026-11-03" : SEO_CONTENT_UPDATED_AT,
  }));
}
