import type { MetadataRoute } from "next";
import { PUBLIC_SITE_PATHS } from "@/lib/public-site";
import { canonicalUrl, SEO_CONTENT_UPDATED_AT } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITE_PATHS.map((path) => ({
    url: canonicalUrl(path),
    // Content date, not the build/crawler access time.
    lastModified: SEO_CONTENT_UPDATED_AT,
  }));
}
