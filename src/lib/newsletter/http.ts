import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
  parseGuideBody,
  parseGuideProfileBody,
  parseNewsletterBody,
  parseRedeemBody,
  parseUnsubscribeToken,
  type GuideLead,
  type GuideProfile,
  type NewsletterLead,
} from "@/lib/newsletter/validate";

const WINDOW_MS = 15 * 60 * 1000;
export const jsonHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export type NewsletterSaveStatus = "subscribed" | "already" | "resubscribed";
export type GuideSaveStatus = "ready" | "already";

export type NewsletterSaveResult = { status: NewsletterSaveStatus; message: string };
export type GuideSaveResult = {
  status: GuideSaveStatus;
  message: string;
  downloadPath: string;
  rememberToken: string;
  slug: string;
};

type Limit = { allowed: boolean; resetAt: number };
type Deps = {
  ip?: (request: Request) => string;
  limit?: (key: string, max: number, windowMs: number) => Limit;
};

function json(status: number, body: unknown, extra?: Record<string, string>): Response {
  return Response.json(body, { status, headers: { ...jsonHeaders, ...extra } });
}

function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originHost = "";
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) return false;
    originHost = parsed.host;
  } catch {
    return false;
  }
  const forwarded = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0]?.trim();
  if (forwarded && forwarded === originHost) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function readBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > 8_000) return null;
  const text = await request.text();
  if (text.length > 8_000) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function limited(request: Request, key: string, max: number, deps: Deps): Response | null {
  const ip = (deps.ip ?? getClientIp)(request);
  const result = (deps.limit ?? isRateLimited)(`${key}:${ip}`, max, WINDOW_MS);
  if (result.allowed) return null;
  const retry = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return json(429, { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." }, { "Retry-After": String(retry) });
}

function unavailable(): Response {
  return json(503, { ok: false, error: "L’inscription est momentanément indisponible. Réessayez plus tard." });
}

export function isUnavailableError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : "";
  return code === "CONFIG" || code === "42P01" || code === "PGRST205" || /does not exist|schema cache|SUPABASE_SERVICE_ROLE_KEY/i.test(message);
}

export async function handleNewsletterSignup(
  request: Request,
  save: (lead: NewsletterLead, request: Request) => Promise<NewsletterSaveResult>,
  deps: Deps = {},
): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { ok: false, error: "Cette demande doit être envoyée depuis le site Felexia." });
  const blocked = limited(request, "newsletter", 5, deps);
  if (blocked) return blocked;
  const parsed = parseNewsletterBody(await readBody(request));
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error });
  if (parsed.honeypot) return json(200, { ok: true, status: "subscribed", message: "Merci, votre inscription est confirmée." });
  try {
    const saved = await save(parsed.lead, request);
    return json(200, { ok: true, status: saved.status, message: saved.message });
  } catch (error) {
    if (isUnavailableError(error)) return unavailable();
    return json(500, { ok: false, error: "L’inscription n’a pas abouti. Réessayez dans un instant." });
  }
}

export async function handleGuideRequest(
  request: Request,
  save: (lead: GuideLead, request: Request) => Promise<GuideSaveResult>,
  deps: Deps = {},
): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { ok: false, error: "Cette demande doit être envoyée depuis le site Felexia." });
  const blocked = limited(request, "guide", 5, deps);
  if (blocked) return blocked;
  const parsed = parseGuideBody(await readBody(request));
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error });
  if (parsed.honeypot) return json(200, { ok: true, status: "ready", message: "Merci. Votre guide se télécharge." });
  try {
    const saved = await save(parsed.lead, request);
    return json(200, { ok: true, ...saved });
  } catch (error) {
    if (isUnavailableError(error)) return unavailable();
    return json(500, { ok: false, error: "Le guide n’a pas pu être préparé. Réessayez dans un instant." });
  }
}

export async function handleGuideProfile(
  request: Request,
  save: (profile: GuideProfile) => Promise<boolean>,
  deps: Deps = {},
): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { ok: false, error: "Cette demande doit être envoyée depuis le site Felexia." });
  const blocked = limited(request, "guide-profile", 8, deps);
  if (blocked) return blocked;
  const parsed = parseGuideProfileBody(await readBody(request));
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error });
  if (parsed.honeypot) return json(200, { ok: true, status: "saved" });
  try {
    const saved = await save(parsed.lead);
    if (!saved) return json(401, { ok: false, error: "Cette étape n’est plus disponible." });
    return json(200, { ok: true, status: "saved" });
  } catch (error) {
    if (isUnavailableError(error)) return unavailable();
    return json(500, { ok: false, error: "L’enregistrement n’a pas abouti. Vous pouvez passer cette étape." });
  }
}

export async function handleGuideRedeem(
  request: Request,
  redeem: (slug: string, token: string) => Promise<GuideSaveResult | null>,
  deps: Deps = {},
): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { ok: false, error: "Cette demande doit être envoyée depuis le site Felexia." });
  const blocked = limited(request, "guide-redeem", 20, deps);
  if (blocked) return blocked;
  const parsed = parseRedeemBody(await readBody(request));
  if (!parsed.ok) return json(400, { ok: false, error: parsed.error });
  if (parsed.honeypot) return json(200, { ok: true, status: "ready", message: "Merci. Votre guide se télécharge." });
  try {
    const saved = await redeem(parsed.slug, parsed.token);
    if (!saved) return json(401, { ok: false, error: "Ce téléchargement n’est plus disponible. Indiquez à nouveau votre e-mail." });
    return json(200, { ok: true, ...saved });
  } catch (error) {
    if (isUnavailableError(error)) return unavailable();
    return json(500, { ok: false, error: "Le guide n’a pas pu être préparé. Réessayez dans un instant." });
  }
}

export async function handleUnsubscribe(
  request: Request,
  run: (token: string) => Promise<"done" | "already" | "invalid">,
  deps: Deps = {},
): Promise<Response> {
  if (!sameOrigin(request)) return json(403, { ok: false, error: "Cette demande doit être envoyée depuis le site Felexia." });
  const blocked = limited(request, "newsletter-unsubscribe", 10, deps);
  if (blocked) return blocked;
  const body = await readBody(request);
  const token = parseUnsubscribeToken(body && typeof body === "object" ? (body as { token?: unknown }).token : null);
  if (!token) return json(400, { ok: false, status: "invalid", error: "Ce lien n’est pas valide." });
  try {
    const status = await run(token);
    if (status === "invalid") return json(400, { ok: false, status, error: "Ce lien n’est pas valide." });
    const message = status === "already"
      ? "Cette adresse est déjà désinscrite."
      : "Vous êtes désinscrit. Vous ne recevrez plus les actualités de Felexia.";
    return json(200, { ok: true, status, message });
  } catch (error) {
    if (isUnavailableError(error)) return unavailable();
    return json(500, { ok: false, error: "La désinscription n’a pas abouti. Réessayez dans un instant." });
  }
}
