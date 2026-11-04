import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Download links stay short. Callers must not sign a longer lifetime than this. */
export const DOWNLOAD_TOKEN_MAX_MS = 15 * 60 * 1000;

export type DownloadClaims = { v: 1; slug: string; gid: string; exp: number };

export function signDownloadToken(claims: DownloadClaims, secret: string, now = Date.now()): string {
  if (!secret || secret.length < 16) throw new Error("Download secret is too short.");
  if (claims.v !== 1 || !SLUG.test(claims.slug) || !UUID.test(claims.gid)) throw new Error("Download claims are invalid.");
  if (!Number.isFinite(claims.exp) || claims.exp <= now || claims.exp > now + DOWNLOAD_TOKEN_MAX_MS) {
    throw new Error("Download expiry is outside the allowed window.");
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyDownloadToken(token: string, secret: string, now = Date.now()): DownloadClaims | null {
  if (!secret || secret.length < 16 || token.length < 20 || token.length > 800) return null;
  const separator = token.indexOf(".");
  if (separator <= 0 || token.indexOf(".", separator + 1) !== -1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const received = Buffer.from(signature);
  const valid = Buffer.from(expected);
  if (received.length !== valid.length || !timingSafeEqual(received, valid)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const claims = parsed as Record<string, unknown>;
    if (claims.v !== 1 || typeof claims.slug !== "string" || typeof claims.gid !== "string" || typeof claims.exp !== "number") return null;
    if (!SLUG.test(claims.slug) || !UUID.test(claims.gid) || !Number.isFinite(claims.exp)) return null;
    if (claims.exp <= now || claims.exp > now + DOWNLOAD_TOKEN_MAX_MS) return null;
    return { v: 1, slug: claims.slug, gid: claims.gid, exp: claims.exp };
  } catch {
    return null;
  }
}

export function downloadSecret(): string | null {
  const secret = process.env.GUIDE_DOWNLOAD_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return secret.length >= 16 ? secret : null;
}
