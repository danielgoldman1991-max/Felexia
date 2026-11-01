import type { MetadataRoute } from "next";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // HTML login/private pages remain crawlable so their noindex can be read.
      // These endpoints may start authentication or expose non-page operations.
      disallow: ["/api/", "/auth/"],
    },
    sitemap: `${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
  };
}
