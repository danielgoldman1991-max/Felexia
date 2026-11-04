import { getProductGuide, guideSource } from "@/lib/content/product-guides";

export const NEWSLETTER_SOURCES = ["footer", "popup", "blog", "guides"] as const;
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];
export const GUIDE_SECTORS = ["Commerce", "Services", "BTP", "Industrie", "Agriculture", "Autre"] as const;

const EMAIL = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export type NewsletterLead = {
  email: string;
  firstName: string | null;
  company: string | null;
  source: NewsletterSource;
};

export type GuideLead = {
  email: string;
  firstName: string | null;
  company: string | null;
  phone: string | null;
  sector: string | null;
  newsletter: boolean;
  slug: string;
  source: string;
};

export type ParseResult<T> =
  | { ok: true; honeypot: true }
  | { ok: true; honeypot: false; lead: T }
  | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function honeypotFilled(body: Record<string, unknown>): boolean {
  const fax = body.fax_number;
  return typeof fax === "string" && fax.trim().length > 0;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 6 || email.length > 254 || email.includes("..") || !EMAIL.test(email)) return null;
  const domain = email.slice(email.lastIndexOf(".") + 1);
  if (domain.length < 2) return null;
  return email;
}

function optionalText(value: unknown, max: number): { ok: true; value: string | null } | { ok: false } {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: true, value: null };
  if (text.length > max) return { ok: false };
  return { ok: true, value: text };
}

function readPhone(value: unknown): { ok: true; value: string | null } | { ok: false } {
  const text = optionalText(value, 30);
  if (!text.ok || !text.value) return text.ok ? { ok: true, value: null } : text;
  if (!/^\+?[0-9][0-9 .()-]{7,28}$/.test(text.value)) return { ok: false };
  return text;
}

export function parseNewsletterBody(body: unknown): ParseResult<NewsletterLead> {
  const fields = record(body);
  if (!fields) return { ok: false, error: "Le formulaire est incomplet." };
  if (honeypotFilled(fields)) return { ok: true, honeypot: true };
  const email = normalizeEmail(fields.email);
  if (!email) return { ok: false, error: "Indiquez une adresse e-mail valide." };
  const firstName = optionalText(fields.firstName, 80);
  const company = optionalText(fields.company, 120);
  if (!firstName.ok || !company.ok) return { ok: false, error: "Certains champs sont trop longs." };
  if (fields.consent !== true) return { ok: false, error: "Cochez la case pour recevoir les actualités." };
  if (typeof fields.source !== "string" || !NEWSLETTER_SOURCES.includes(fields.source as NewsletterSource)) {
    return { ok: false, error: "Le formulaire est incomplet." };
  }
  return {
    ok: true,
    honeypot: false,
    lead: { email, firstName: firstName.value, company: company.value, source: fields.source as NewsletterSource },
  };
}

export function parseGuideBody(body: unknown): ParseResult<GuideLead> {
  const fields = record(body);
  if (!fields) return { ok: false, error: "Le formulaire est incomplet." };
  if (honeypotFilled(fields)) return { ok: true, honeypot: true };
  const email = normalizeEmail(fields.email);
  if (!email) return { ok: false, error: "Indiquez une adresse e-mail valide." };
  const firstName = optionalText(fields.firstName, 80);
  const company = optionalText(fields.company, 120);
  const phone = readPhone(fields.phone);
  if (!firstName.ok || !company.ok) return { ok: false, error: "Certains champs sont trop longs." };
  if (!phone.ok) return { ok: false, error: "Le numéro de téléphone n’est pas valide." };
  let sector: string | null = null;
  if (fields.sector != null && fields.sector !== "") {
    if (typeof fields.sector !== "string" || !GUIDE_SECTORS.includes(fields.sector as (typeof GUIDE_SECTORS)[number])) {
      return { ok: false, error: "Choisissez un secteur dans la liste." };
    }
    sector = fields.sector;
  }
  if (fields.guideConsent !== true) return { ok: false, error: "Cochez la case pour recevoir le guide par e-mail." };
  if (typeof fields.newsletter !== "boolean") return { ok: false, error: "Le formulaire est incomplet." };
  if (typeof fields.slug !== "string" || !getProductGuide(fields.slug)) return { ok: false, error: "Ce guide n’est pas disponible." };
  return {
    ok: true,
    honeypot: false,
    lead: {
      email,
      firstName: firstName.value,
      company: company.value,
      phone: phone.value,
      sector,
      newsletter: fields.newsletter,
      slug: fields.slug,
      source: guideSource(fields.slug),
    },
  };
}

const REMEMBER = /^[A-Za-z0-9_-]{32,120}$/;

export function parseRedeemBody(body: unknown): { ok: true; honeypot: true } | { ok: true; honeypot: false; slug: string; token: string } | { ok: false; error: string } {
  const fields = record(body);
  if (!fields) return { ok: false, error: "Le téléchargement n’est plus disponible. Indiquez à nouveau votre e-mail." };
  if (honeypotFilled(fields)) return { ok: true, honeypot: true };
  if (typeof fields.slug !== "string" || !getProductGuide(fields.slug)) return { ok: false, error: "Ce guide n’est pas disponible." };
  if (typeof fields.token !== "string" || !REMEMBER.test(fields.token)) {
    return { ok: false, error: "Ce téléchargement n’est plus disponible. Indiquez à nouveau votre e-mail." };
  }
  return { ok: true, honeypot: false, slug: fields.slug, token: fields.token };
}

const UNSUBSCRIBE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUnsubscribeToken(value: unknown): string | null {
  return typeof value === "string" && UNSUBSCRIBE.test(value) ? value.toLowerCase() : null;
}
