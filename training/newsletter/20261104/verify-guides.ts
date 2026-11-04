import assert from "node:assert/strict";
import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PRODUCT_GUIDES, getProductGuide, guideSource } from "../../../src/lib/content/product-guides";
import { signDownloadToken, verifyDownloadToken, DOWNLOAD_TOKEN_MAX_MS } from "../../../src/lib/guides/download-token";
import { handleGuideDownload } from "../../../src/lib/guides/download-http";
import { readGuideGrant, writeGuideGrant, clearGuideGrant } from "../../../src/lib/guides/remember";
import { hasAuthSessionCookie } from "../../../src/lib/newsletter/audience";
import { handleGuideRequest, handleNewsletterSignup, handleUnsubscribe } from "../../../src/lib/newsletter/http";
import { promptHidden, promptRecord, NEWSLETTER_PROMPT_DAYS } from "../../../src/lib/newsletter/prompt-storage";
import { PUBLIC_SITE_PATHS, isPublicSitePath } from "../../../src/lib/public-site";
import { normalizeEmail, parseGuideBody, parseNewsletterBody } from "../../../src/lib/newsletter/validate";

const results: string[] = [];
function check(value: unknown, name: string) { assert.ok(value, name); results.push(name); }
const secret = "test-secret-value-0123456789";
const now = 1_700_000_000_000;
const origin = "https://www.felexia.pro";

function request(url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function main() {
  const guide = getProductGuide("pro");
  check(guide?.pages === 32 && guide.filename === "FelexiaERP_PRO_Guide.pdf", "PRO guide is the 32-page product PDF");
  check(PRODUCT_GUIDES.length === 1 && guideSource("pro") === "guide:pro", "Guide source is guide:<slug>");
  check(isPublicSitePath("/guides") && PUBLIC_SITE_PATHS.includes("/guides"), "Guides page is a public route");
  check(!isPublicSitePath("/newsletter/desinscription") && !isPublicSitePath("/api/guides/download"), "Download and unsubscribe stay off the public index");

  const pdf = resolve("private/guides/FelexiaERP_PRO_Guide.pdf");
  const bytes = readFileSync(pdf);
  check(bytes.subarray(0, 5).toString() === "%PDF-" && bytes.byteLength > 1_000_000, "PDF lives outside public/ and is a real document");
  check(!existsSync(resolve("public/guides/FelexiaERP_PRO_Guide.pdf")), "PDF is not a guessable public file");
  const webp = statSync(resolve("public" + guide!.cover.webp));
  const avif = statSync(resolve("public" + guide!.cover.avif));
  check(webp.size < 150_000 && avif.size < 150_000 && webp.size > 1000 && avif.size > 1000, "Cover images are optimized");

  const header = readFileSync(resolve("src/components/landing/LandingHeader.tsx"), "utf8");
  const footer = readFileSync(resolve("src/components/landing/LandingFooter.tsx"), "utf8");
  const landingPro = readFileSync(resolve("src/components/landing/LandingPro.tsx"), "utf8");
  const pricing = readFileSync(resolve("src/components/landing/LandingPricing.tsx"), "utf8");
  check(header.includes('href: "/guides"') && footer.includes('href: "/guides"'), "Header and footer link to the guides page");
  check(landingPro.includes("ProGuideCta") && pricing.includes("ProGuideCta"), "Landing PRO and pricing expose the guide CTA");
  check(!readFileSync(resolve("src/app/guides/page.tsx"), "utf8").includes("/guides/FelexiaERP_PRO_Guide.pdf"), "Guides page does not link a public PDF");

  const migration = readFileSync(resolve("supabase/migrations/125_newsletter_subscribers.sql"), "utf8");
  const rollback = readFileSync(resolve("supabase/rollbacks/125_newsletter_subscribers_rollback.sql"), "utf8");
  check(migration.includes("newsletter_subscribers") && migration.includes("guide_downloads") && migration.includes("guide_access_grants"), "Migration creates subscribers, downloads and grants");
  check(migration.includes("enable row level security") && migration.includes("revoke all on table public.newsletter_subscribers from public, anon, authenticated"), "RLS is on and anon cannot read subscribers");
  check(!/grant\s+select[\s\S]*to\s+anon/i.test(migration), "Migration does not grant select to anon");
  check(migration.includes("guide:[a-z0-9]+") && migration.includes("email = lower(email)"), "Email is stored lowercased and guide sources are constrained");
  check(rollback.includes("drop table if exists public.guide_access_grants") && rollback.includes("drop table if exists public.newsletter_subscribers"), "Rollback drops only the new tables");

  check(normalizeEmail("  Ada@Example.com ") === "ada@example.com", "Email is trimmed and lowercased");
  check(normalizeEmail("not-an-email") === null && normalizeEmail("a@b") === null, "Invalid emails are rejected");
  const newsletter = parseNewsletterBody({ email: "ada@example.com", firstName: "Ada", company: "", consent: true, source: "footer", fax_number: "" });
  check(newsletter.ok && !newsletter.honeypot && newsletter.lead.source === "footer", "Newsletter payload accepts a consented footer signup");
  check(!parseNewsletterBody({ email: "ada@example.com", consent: false, source: "footer" }).ok, "Newsletter consent is required");
  const bot = parseGuideBody({ email: "ada@example.com", guideConsent: true, newsletter: false, slug: "pro", fax_number: "bot" });
  check(bot.ok && bot.honeypot, "Honeypot short-circuits the guide form");
  const guideLead = parseGuideBody({ email: "ada@example.com", firstName: "Ada", guideConsent: true, newsletter: false, slug: "pro", sector: "Commerce", fax_number: "" });
  check(guideLead.ok && !guideLead.honeypot && guideLead.lead.source === "guide:pro" && guideLead.lead.newsletter === false, "Guide request records source guide:pro without forcing the newsletter");
  check(!parseGuideBody({ email: "ada@example.com", guideConsent: false, newsletter: false, slug: "pro" }).ok, "Guide delivery consent stays explicit");

  const claims = { v: 1 as const, slug: "pro", gid: "11111111-1111-4111-8111-111111111111", exp: now + 10 * 60 * 1000 };
  const token = signDownloadToken(claims, secret, now);
  check(JSON.stringify(verifyDownloadToken(token, secret, now)) === JSON.stringify(claims), "Signed download token round-trips");
  check(verifyDownloadToken(token.slice(0, -2) + "aa", secret, now) === null, "Tampered download token is rejected");
  check(verifyDownloadToken(token, secret, now + DOWNLOAD_TOKEN_MAX_MS) === null, "Expired download token is rejected");
  assert.throws(() => signDownloadToken({ ...claims, exp: now + DOWNLOAD_TOKEN_MAX_MS + 1000 }, secret, now));
  results.push("Download tokens cannot be signed for longer than 15 minutes");

  const file = new TextEncoder().encode("%PDF-1.4\n%fixture\n");
  let reads = 0;
  const denied = await handleGuideDownload(request(`${origin}/api/guides/download?token=nope`), {
    now, secret, grantActive: async () => true, readFile: async () => { reads += 1; return { bytes: file, filename: guide!.filename }; },
    ip: () => "203.0.113.8", limit: () => ({ allowed: true, resetAt: now }),
  });
  check(denied.status === 401 && reads === 0, "Download route refuses an invalid token before reading the file");
  const inactive = await handleGuideDownload(request(`${origin}/api/guides/download?token=${encodeURIComponent(token)}`), {
    now, secret, grantActive: async () => false, readFile: async () => { reads += 1; return { bytes: file, filename: guide!.filename }; },
    ip: () => "203.0.113.8", limit: () => ({ allowed: true, resetAt: now }),
  });
  check(inactive.status === 401 && reads === 0, "A signed token still needs a live grant");
  const ok = await handleGuideDownload(request(`${origin}/api/guides/download?token=${encodeURIComponent(token)}`), {
    now, secret, grantActive: async () => true, readFile: async () => { reads += 1; return { bytes: file, filename: guide!.filename }; },
    ip: () => "203.0.113.8", limit: () => ({ allowed: true, resetAt: now }),
  });
  const body = new Uint8Array(await ok.arrayBuffer());
  check(ok.status === 200 && ok.headers.get("content-type") === "application/pdf" && ok.headers.get("content-disposition")?.includes("FelexiaERP_PRO_Guide.pdf") && body[0] === 0x25, "Valid token streams the PDF as an attachment");
  check(ok.headers.get("cache-control")?.includes("no-store") && ok.headers.get("x-robots-tag")?.includes("noindex"), "Download responses are private and not indexed");

  let saved = 0;
  const missingConsent = await handleNewsletterSignup(request(`${origin}/api/newsletter`, { email: "ada@example.com", consent: false, source: "footer" }), async () => { saved += 1; return { status: "subscribed", message: "no" }; });
  check(missingConsent.status === 400 && saved === 0, "Newsletter API refuses a signup without consent");
  const honeypot = await handleNewsletterSignup(request(`${origin}/api/newsletter`, { email: "ada@example.com", consent: true, source: "footer", fax_number: "spam" }), async () => { saved += 1; return { status: "subscribed", message: "no" }; });
  const honeypotBody = await honeypot.json() as { message?: string };
  check(honeypot.status === 200 && saved === 0 && honeypotBody.message === "Merci, votre inscription est confirmée.", "Honeypot looks successful and stores nothing");
  const duplicate = await handleNewsletterSignup(request(`${origin}/api/newsletter`, { email: "Ada@Example.com", consent: true, source: "blog", firstName: "Ada" }), async (lead) => {
    saved += 1;
    check(lead.email === "ada@example.com" && lead.source === "blog", "Handler passes a normalized lead");
    return { status: "already", message: "Vous êtes déjà inscrit." };
  });
  const duplicateBody = await duplicate.json() as { status?: string; message?: string };
  check(duplicate.status === 200 && duplicateBody.status === "already" && duplicateBody.message === "Vous êtes déjà inscrit.", "Duplicate newsletter is a success");
  const foreign = await handleGuideRequest(new Request(`${origin}/api/guides/request`, { method: "POST", headers: { origin: "https://evil.invalid", "content-type": "application/json" }, body: "{}" }), async () => { saved += 1; throw new Error("no"); });
  check(foreign.status === 403 && saved === 1, "Cross-site guide request is refused");

  const unsub = await handleUnsubscribe(request(`${origin}/api/newsletter/unsubscribe`, { token: "not-a-token" }), async () => "done");
  check(unsub.status === 400, "Unsubscribe rejects a malformed token before storage");

  check(hasAuthSessionCookie("sb-abc-auth-token=eyJ") && hasAuthSessionCookie("theme=light; sb-abc-auth-token.0=eyJ"), "Auth session cookies suppress the public prompt");
  check(!hasAuthSessionCookie("sb-abc-auth-token-code-verifier=abc") && !hasAuthSessionCookie(""), "PKCE verifier and empty cookies are not a session");

  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
  writeGuideGrant("pro", "a".repeat(40), storage);
  check(readGuideGrant("pro", storage) === "a".repeat(40), "Returning visitors keep a remember token in storage");
  clearGuideGrant("pro", storage);
  check(readGuideGrant("pro", storage) === null, "A rejected remember token can be forgotten");
  const record = promptRecord(now);
  check(record.until - now === NEWSLETTER_PROMPT_DAYS * 24 * 60 * 60 * 1000 && promptHidden(JSON.stringify(record), now + 1000) && !promptHidden(JSON.stringify(record), record.until), "Newsletter prompt stays dismissed for 30 days");

  console.log(JSON.stringify({ passed: true, assertions: results.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
