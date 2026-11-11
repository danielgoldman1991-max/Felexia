import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { guideSource } from "@/lib/content/product-guides";
import { DOWNLOAD_TOKEN_MAX_MS, downloadSecret, signDownloadToken } from "@/lib/guides/download-token";
import { hasServiceRoleKey } from "@/lib/env";
import { getClientIp } from "@/lib/rate-limit";
import type { GuideSaveResult, NewsletterSaveResult } from "@/lib/newsletter/http";
import type { GuideLead, GuideProfile, NewsletterLead } from "@/lib/newsletter/validate";
import { createClient as createServiceClient } from "@/lib/supabase/service";

const GRANT_MS = 180 * 24 * 60 * 60 * 1000;
const MESSAGES = {
  subscribed: "Merci, votre inscription est confirmée.",
  already: "Vous êtes déjà inscrit.",
  resubscribed: "Votre inscription est de nouveau active.",
  guide: "Merci. Votre guide se télécharge.",
  guideAlready: "Vous êtes déjà inscrit. Votre guide est prêt.",
};

type Subscriber = {
  id: string;
  consent: boolean;
  unsubscribed_at: string | null;
};

function configError(): Error {
  const error = new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  (error as { code?: string }).code = "CONFIG";
  return error;
}

function client() {
  if (!hasServiceRoleKey() || !downloadSecret()) throw configError();
  return createServiceClient();
}

export function hashIp(ip: string): string {
  const salt = process.env.NEWSLETTER_IP_SALT || "felexia-newsletter-v1";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function userAgent(request: Request): string | null {
  const value = request.headers.get("user-agent")?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() ?? "";
  return value ? value.slice(0, 300) : null;
}

function requestMeta(request: Request) {
  return { ip_hash: hashIp(getClientIp(request)), user_agent: userAgent(request) };
}

async function findSubscriber(email: string): Promise<Subscriber | null> {
  const { data, error } = await client()
    .from("newsletter_subscribers")
    .select("id, consent, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data as Subscriber | null;
}

export async function saveNewsletter(lead: NewsletterLead, request: Request): Promise<NewsletterSaveResult> {
  const existing = await findSubscriber(lead.email);
  const now = new Date().toISOString();
  if (!existing) {
    const { error } = await client().from("newsletter_subscribers").insert({
      email: lead.email,
      first_name: lead.firstName,
      company: lead.company,
      source: lead.source,
      consent: true,
      consent_at: now,
      ...requestMeta(request),
    });
    if (error && error.code !== "23505") throw error;
    if (error?.code === "23505") return { status: "already", message: MESSAGES.already };
    return { status: "subscribed", message: MESSAGES.subscribed };
  }
  if (existing.consent && !existing.unsubscribed_at) return { status: "already", message: MESSAGES.already };
  const patch: Record<string, unknown> = {
    source: lead.source,
    consent: true,
    consent_at: now,
    unsubscribed_at: null,
    ...requestMeta(request),
  };
  if (lead.firstName) patch.first_name = lead.firstName;
  if (lead.company) patch.company = lead.company;
  const { error } = await client().from("newsletter_subscribers").update(patch).eq("id", existing.id);
  if (error) throw error;
  return { status: existing.unsubscribed_at ? "resubscribed" : "subscribed", message: existing.unsubscribed_at ? MESSAGES.resubscribed : MESSAGES.subscribed };
}

function signedDownload(slug: string, grantId: string, now: number): string {
  const secret = downloadSecret();
  if (!secret) throw configError();
  const token = signDownloadToken({ v: 1, slug, gid: grantId, exp: now + DOWNLOAD_TOKEN_MAX_MS }, secret, now);
  return `/api/guides/download?token=${encodeURIComponent(token)}`;
}

async function recordDownload(subscriberId: string, slug: string): Promise<void> {
  const { error } = await client().from("guide_downloads").insert({ subscriber_id: subscriberId, guide_slug: slug });
  if (error) throw error;
}

async function createGrant(subscriberId: string, slug: string, now: number): Promise<{ id: string; rememberToken: string }> {
  const rememberToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rememberToken).digest("hex");
  const { data, error } = await client().from("guide_access_grants").insert({
    subscriber_id: subscriberId,
    guide_slug: slug,
    token_hash: tokenHash,
    expires_at: new Date(now + GRANT_MS).toISOString(),
  }).select("id").single();
  if (error || !data?.id) throw error ?? new Error("Grant was not created.");
  return { id: String(data.id), rememberToken };
}

export async function saveGuideRequest(lead: GuideLead, request: Request): Promise<GuideSaveResult> {
  const now = Date.now();
  const existing = await findSubscriber(lead.email);
  let current = existing;
  let subscriberId = existing?.id;
  let alreadyNewsletter = false;
  if (!subscriberId) {
    const { data, error } = await client().from("newsletter_subscribers").insert({
      email: lead.email,
      first_name: lead.firstName,
      company: lead.company,
      phone: lead.phone,
      sector: lead.sector,
      source: lead.source || guideSource(lead.slug),
      consent: lead.newsletter,
      consent_at: lead.newsletter ? new Date(now).toISOString() : null,
      ...requestMeta(request),
    }).select("id").single();
    if (error?.code === "23505") {
      const raced = await findSubscriber(lead.email);
      if (!raced) throw error;
      current = raced;
      subscriberId = raced.id;
    } else if (error || !data?.id) {
      throw error ?? new Error("Subscriber was not created.");
    } else {
      subscriberId = String(data.id);
    }
  }
  if (current && subscriberId) {
    const patch: Record<string, unknown> = { ...requestMeta(request) };
    if (lead.firstName) patch.first_name = lead.firstName;
    if (lead.company) patch.company = lead.company;
    if (lead.phone) patch.phone = lead.phone;
    if (lead.sector) patch.sector = lead.sector;
    if (lead.newsletter) {
      alreadyNewsletter = current.consent && !current.unsubscribed_at;
      if (!alreadyNewsletter) {
        patch.consent = true;
        patch.consent_at = new Date(now).toISOString();
        patch.unsubscribed_at = null;
      }
    }
    const { error } = await client().from("newsletter_subscribers").update(patch).eq("id", subscriberId);
    if (error) throw error;
  }
  const grant = await createGrant(subscriberId!, lead.slug, now);
  await recordDownload(subscriberId!, lead.slug);
  return {
    status: alreadyNewsletter ? "already" : "ready",
    message: alreadyNewsletter ? MESSAGES.guideAlready : MESSAGES.guide,
    downloadPath: signedDownload(lead.slug, grant.id, now),
    rememberToken: grant.rememberToken,
    slug: lead.slug,
  };
}

export async function saveGuideProfile(profile: GuideProfile): Promise<boolean> {
  const tokenHash = createHash("sha256").update(profile.token).digest("hex");
  const { data, error } = await client()
    .from("guide_access_grants")
    .select("subscriber_id, guide_slug, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.guide_slug !== profile.slug || new Date(String(data.expires_at)).getTime() <= Date.now()) return false;
  const patch: Record<string, string> = {};
  if (profile.company) patch.company = profile.company;
  if (profile.phone) patch.phone = profile.phone;
  if (profile.sector) patch.sector = profile.sector;
  if (Object.keys(patch).length === 0) return true;
  const { error: updateError } = await client().from("newsletter_subscribers").update(patch).eq("id", data.subscriber_id);
  if (updateError) throw updateError;
  return true;
}

export async function redeemGuideAccess(slug: string, token: string): Promise<GuideSaveResult | null> {
  const now = Date.now();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await client()
    .from("guide_access_grants")
    .select("id, subscriber_id, guide_slug, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.guide_slug !== slug) return null;
  if (new Date(String(data.expires_at)).getTime() <= now) return null;
  const { error: touchError } = await client().from("guide_access_grants").update({
    last_used_at: new Date(now).toISOString(),
    expires_at: new Date(now + GRANT_MS).toISOString(),
  }).eq("id", data.id);
  if (touchError) throw touchError;
  await recordDownload(String(data.subscriber_id), slug);
  return {
    status: "ready",
    message: MESSAGES.guide,
    downloadPath: signedDownload(slug, String(data.id), now),
    rememberToken: token,
    slug,
  };
}

export async function grantIsActive(gid: string, slug: string): Promise<boolean> {
  const { data, error } = await client()
    .from("guide_access_grants")
    .select("guide_slug, expires_at")
    .eq("id", gid)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.guide_slug !== slug) return false;
  return new Date(String(data.expires_at)).getTime() > Date.now();
}

export async function unsubscribeNewsletter(token: string): Promise<"done" | "already" | "invalid"> {
  const { data, error } = await client()
    .from("newsletter_subscribers")
    .select("id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return "invalid";
  if (data.unsubscribed_at) return "already";
  const { error: updateError } = await client().from("newsletter_subscribers").update({
    consent: false,
    consent_at: null,
    unsubscribed_at: new Date().toISOString(),
  }).eq("id", data.id);
  if (updateError) throw updateError;
  return "done";
}
