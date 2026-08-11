import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

const PUBLIC_PATHS = [
  { path: "/", priority: 1 },
  { path: "/pricing", priority: 0.8 },
  { path: "/mentions-legales", priority: 0.4 },
  { path: "/confidentialite", priority: 0.4 },
  { path: "/conditions", priority: 0.4 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppUrl();
  const lastModified = new Date();
  return PUBLIC_PATHS.map(({ path, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority,
  }));
}
