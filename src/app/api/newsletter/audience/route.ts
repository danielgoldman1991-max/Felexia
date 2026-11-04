import { hasAuthSessionCookie } from "@/lib/newsletter/audience";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json(
    { signedIn: hasAuthSessionCookie(request.headers.get("cookie")) },
    { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } },
  );
}
