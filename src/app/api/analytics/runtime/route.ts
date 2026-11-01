import { analyticsRuntimeDocument } from "@/lib/analytics/public-analytics";

export const dynamic = "force-dynamic";

/** Inert, same-origin HTTPS frame; no auth, request data, cookies or external calls. */
export function GET() {
  return new Response(analyticsRuntimeDocument(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
