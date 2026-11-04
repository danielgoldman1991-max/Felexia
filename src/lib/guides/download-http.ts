import { getProductGuide } from "@/lib/content/product-guides";
import { DOWNLOAD_TOKEN_MAX_MS, verifyDownloadToken } from "@/lib/guides/download-token";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export type GuideFile = { bytes: Uint8Array; filename: string };

type Deps = {
  now?: number;
  secret: string | null;
  grantActive: (gid: string, slug: string) => Promise<boolean>;
  readFile: (slug: string) => Promise<GuideFile | null>;
  ip?: (request: Request) => string;
  limit?: (key: string, max: number, windowMs: number) => { allowed: boolean; resetAt: number };
};

function json(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status, headers });
}

export async function handleGuideDownload(request: Request, deps: Deps): Promise<Response> {
  const ip = (deps.ip ?? getClientIp)(request);
  const limit = (deps.limit ?? isRateLimited)(`guide-file:${ip}`, 30, 15 * 60 * 1000);
  if (!limit.allowed) return json(429, "Trop de tentatives. Réessayez dans quelques minutes.");
  if (!deps.secret) return json(503, "Le téléchargement est momentanément indisponible.");
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const claims = verifyDownloadToken(token, deps.secret, deps.now ?? Date.now());
  if (!claims || !getProductGuide(claims.slug)) return json(401, "Ce lien de téléchargement n’est plus valable.");
  if (claims.exp - (deps.now ?? Date.now()) > DOWNLOAD_TOKEN_MAX_MS) return json(401, "Ce lien de téléchargement n’est plus valable.");
  const active = await deps.grantActive(claims.gid, claims.slug);
  if (!active) return json(401, "Ce lien de téléchargement n’est plus valable.");
  const file = await deps.readFile(claims.slug);
  if (!file || file.bytes.byteLength < 5 || Buffer.from(file.bytes.subarray(0, 5)).toString() !== "%PDF-") {
    return json(404, "Le guide est introuvable.");
  }
  const filename = file.filename.replace(/[^A-Za-z0-9._-]/g, "") || "guide.pdf";
  return new Response(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
