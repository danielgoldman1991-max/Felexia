import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PUBLIC_SITE_ORIGIN, PUBLIC_SITE_PATHS, isPublicSitePath } from "../../../src/lib/public-site";
import { ROOT_METADATA, canonicalUrl, createPublicMetadata, getFaqPageStructuredData, getSiteStructuredData, getSoftwareApplicationStructuredData, readGoogleSiteVerification, serializeJsonLd, SEO_CONTENT_UPDATED_AT } from "../../../src/lib/seo";
import { HOME_FAQS } from "../../../src/lib/content/public-faq";
import { GUIDES } from "../../../src/lib/content/guides";
import { BLOG_ARTICLES } from "../../../src/lib/content/blog";
import { articleWordCount } from "../../../src/lib/content/blog/text";
import sitemap from "../../../src/app/sitemap";
import robots from "../../../src/app/robots";

const results: string[] = [];
function check(value: unknown, name: string) { assert.ok(value, name); results.push(name); }
const object = (value: unknown) => value as Record<string, unknown>;
const GOOGLE_OWNERSHIP_SHA256 = "24d198949233f761310ad02311e9ff611f1bcfdd451218612cf0bbbd1a7a8412";

async function main() {
  check(PUBLIC_SITE_ORIGIN === "https://www.felexia.pro", "SEO and public consent use the fixed production www origin");
  check(PUBLIC_SITE_PATHS.length === 17 && new Set(PUBLIC_SITE_PATHS).size === 17, "Public routes are explicit and unique");
  for (const path of PUBLIC_SITE_PATHS) {
    const metadata = createPublicMetadata({ title: "Public title", description: "Public description", path });
    check(isPublicSitePath(path) && isPublicSitePath(path === "/" ? "/" : path + "/"), "Public pathname accepted: " + path);
    check(metadata.alternates?.canonical === canonicalUrl(path), "Canonical excludes auth/preview origins: " + path);
    check(object(metadata.robots).index === true && object(metadata.robots).follow === true, "Public indexing explicitly overrides private default: " + path);
    check(object(metadata.openGraph).url === canonicalUrl(path) && object(metadata.twitter).card === "summary_large_image", "Public social metadata names the current page: " + path);
  }
  for (const path of ["/login", "/auth/callback", "/onboarding/entreprise", "/dashboard", "/pro/private", "/pricing?email=private", "/pricing#private", "//evil.invalid", "https://evil.invalid", "/\\evil.invalid", ""]) {
    check(!isPublicSitePath(path), "Private/unsafe path cannot opt into public consent or indexing: " + path);
    assert.throws(() => createPublicMetadata({ title: "Unsafe", description: "Unsafe", path }));
  }
  for (const path of ["//evil.invalid", "https://evil.invalid", "/pricing?email=private", "/pricing#private", "/\\evil.invalid"]) assert.throws(() => canonicalUrl(path));
  check(object(ROOT_METADATA.robots).index === false && object(ROOT_METADATA.robots).follow === false, "Unknown/private HTML inherits noindex and nofollow");
  check(!ROOT_METADATA.alternates?.canonical, "Root layout never assigns a homepage canonical to private routes");
  check(String(ROOT_METADATA.metadataBase) === PUBLIC_SITE_ORIGIN + "/", "Metadata base does not depend on OAuth getAppUrl");

  const map = sitemap();
  check(JSON.stringify(map.map(entry => entry.url)) === JSON.stringify(PUBLIC_SITE_PATHS.map(canonicalUrl)), "Sitemap includes only the public canonical routes");
  const revisedPages = new Set(["/essentiel", "/pro", "/confidentialite"].map(canonicalUrl));
  check(map.every(entry => {
    const path = new URL(entry.url).pathname;
    const article = BLOG_ARTICLES.find((item) => item.path === path);
    const expected = article?.updatedAt ?? (revisedPages.has(entry.url) ? "2026-11-03" : SEO_CONTENT_UPDATED_AT);
    return entry.lastModified === expected;
  }), "Sitemap dates describe each page’s content revision, not crawler/build time");
  check(robots().sitemap === PUBLIC_SITE_ORIGIN + "/sitemap.xml", "Robots advertises the www sitemap");
  const rules = object(robots().rules);
  check(JSON.stringify(rules.disallow) === JSON.stringify(["/api/", "/auth/"]), "Only action/API endpoints are excluded from crawling; login noindex stays observable");

  const site = getSiteStructuredData();
  const organization = site["@graph"].find(node => node["@type"] === "Organization");
  check(site["@graph"].some(node => node["@type"] === "Organization") && site["@graph"].some(node => node["@type"] === "WebSite"), "Organization and WebSite describe the real brand");
  check(organization && "sameAs" in organization && JSON.stringify(organization.sameAs) === JSON.stringify(["https://www.instagram.com/felexiaerp/", "https://www.linkedin.com/company/felexiaerp/"]), "Organization sameAs lists the known Instagram and LinkedIn profiles");
  check(site["@graph"].every(node => node.url === PUBLIC_SITE_ORIGIN + "/"), "Structured site identities use the same www origin");
  const app = getSoftwareApplicationStructuredData();
  check(app["@type"] === "SoftwareApplication" && app.applicationCategory === "BusinessApplication", "Software describes business management");
  check(JSON.stringify(app.offers.map(offer => offer.price)) === "[99,1188]", "Only the approved ESSENTIEL prices are encoded");
  check(app.offers.every(offer => offer.name.startsWith("ESSENTIEL") && offer.priceCurrency === "MAD" && offer.priceSpecification.valueAddedTaxIncluded === false), "PRO has no invented price and ESSENTIEL amounts explicitly exclude tax");
  check(JSON.stringify(app.offers.map(offer => offer.priceSpecification.billingDuration)) === '["P1M","P1Y"]', "Monthly and annual billing intervals are distinct");
  check(app.description.includes("15 jours") && app.description.includes("sans carte bancaire") && app.description.includes("PRO est disponible uniquement sur devis"), "Trial and quote-only PRO match the public product");
  check(!/"aggregateRating"|"review"|"address"|"legalName"/.test(JSON.stringify([site, app])), "No rating, review, legal identity or address is invented");
  const homeFaq = getFaqPageStructuredData(HOME_FAQS, "/");
  check(homeFaq["@type"] === "FAQPage" && homeFaq.mainEntity.length === HOME_FAQS.length && homeFaq.mainEntity.every((item, index) => item.name === HOME_FAQS[index]?.question && item.acceptedAnswer.text === HOME_FAQS[index]?.answer), "FAQPage repeats the visible homepage answers");
  check(readGoogleSiteVerification() === null, "Search Console verification stays absent without an owner code");
  process.env.GOOGLE_SITE_VERIFICATION = "not a code";
  check(readGoogleSiteVerification() === null, "Malformed Search Console code is ignored");
  process.env.GOOGLE_SITE_VERIFICATION = "google-code_OK123";
  check(readGoogleSiteVerification() === "google-code_OK123", "A well-formed Search Console code can be emitted");
  delete process.env.GOOGLE_SITE_VERIFICATION;
  for (const guide of GUIDES) {
    check(isPublicSitePath(guide.path), "Guide is on the public allowlist: " + guide.path);
    check(!guide.description.includes("conforme DGI") && !guide.h1.includes("conforme DGI"), "Guide does not claim DGI compliance: " + guide.path);
  }
  const forbidden = ["conforme DGI", "certifié DGI", "certifiée DGI", "homologué", "validé par la DGI", "100 % conforme", "le moins cher", "n° 1 au"];
  check(BLOG_ARTICLES.length === 6 && BLOG_ARTICLES.every((article) => isPublicSitePath(article.path)), "Blog articles stay on the public allowlist");
  const shortArticles = new Set(["plf-2027-pme-maroc"]);
  for (const article of BLOG_ARTICLES) {
    const words = articleWordCount(article);
    const corpus = JSON.stringify(article);
    const [minWords, maxWords] = shortArticles.has(article.slug) ? [600, 900] : [1200, 1800];
    check(words >= minWords && words <= maxWords, `Article length stays in the editorial range (${words}): ` + article.slug);
    check(article.title.length <= 60, "Article title stays within 60 characters: " + article.slug);
    check(article.description.length >= 140 && article.description.length <= 155, "Article description stays within 140–155 characters: " + article.slug);
    check(article.cover.alt.length >= 80 && article.cover.alt.length <= 125, "Cover alt text stays descriptive: " + article.slug);
    check(article.questions.length >= 4 && article.questions.length <= 6, "Article FAQ stays within 4–6 questions: " + article.slug);
    check(statSync(resolve("public" + article.cover.webp)).size <= 150_000 && statSync(resolve("public" + article.cover.avif)).size <= 150_000, "Cover files stay under 150 KB: " + article.slug);
    check(forbidden.every((phrase) => !corpus.toLowerCase().includes(phrase.toLowerCase())), "Article avoids forbidden compliance claims: " + article.slug);
  }
  const mentions = BLOG_ARTICLES.find((article) => article.slug === "mentions-obligatoires-facture-maroc");
  check(mentions?.sources.some((source) => source.href.includes("tax.gov.ma")) && mentions?.sources.some((source) => source.href.includes("sgg.gov.ma")), "Invoice article cites the DGI page and the official bulletin");
  const footer = readFileSync(resolve("src/components/landing/LandingFooter.tsx"), "utf8");
  check(footer.includes("https://www.instagram.com/felexiaerp/") && footer.includes("https://www.linkedin.com/company/felexiaerp/") && footer.includes("TODO") && !/facebook\.com/i.test(footer), "Footer links the known Instagram and LinkedIn profiles, and no invented Facebook profile");
  const heroWebp = statSync(resolve("public/images/felexia-horizon-v1.webp")).size;
  const heroAvif = statSync(resolve("public/images/felexia-horizon-v1.avif")).size;
  const heroPng = statSync(resolve("public/images/felexia-horizon-v1.png")).size;
  check(heroWebp < heroPng / 4 && heroAvif < heroPng / 4, "Hero WebP and AVIF are much smaller than the source PNG");
  check(statSync(resolve("public/brand/felexiaerp-logo-horizontal.webp")).size < 30_000 && statSync(resolve("public/brand/felexiaerp-logo-horizontal.avif")).size < 30_000, "Header logo is a sized modern file, not the full PNG");
  const injected = { name: "</script><script>unsafe</script>" };
  check(!serializeJsonLd(injected).includes("<") && JSON.parse(serializeJsonLd(injected)).name === injected.name, "JSON-LD cannot close its script element");

  const { default: config } = await import("../../../next.config.mjs");
  const require = createRequire(resolve("package.json"));
  const { pathToRegexp } = require("next/dist/compiled/path-to-regexp") as { pathToRegexp(source: string): RegExp };
  const readHeaders = config.headers;
  assert.ok(readHeaders, "Private response headers are configured");
  const headers = await readHeaders();
  const privateHeader = headers.find(route => route.headers.some(header => header.key === "X-Robots-Tag"));
  assert.ok(privateHeader);
  const privatePattern = pathToRegexp(privateHeader.source);
  for (const entry of readdirSync(resolve("src/app"), { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    if (isPublicSitePath("/" + entry.name)) continue;
    check(privatePattern.test("/" + entry.name) && privatePattern.test("/" + entry.name + "/nested"), "Private root has an HTTP noindex response header: " + entry.name);
  }
  for (const path of [...PUBLIC_SITE_PATHS, "/google9cbdd88855e0d08d.html", "/robots.txt", "/sitemap.xml", "/opengraph-image", "/brand/felexiaerp-mark.png", "/_next/static/chunk.js"]) check(!privatePattern.test(path), "Public page/asset/ownership file has no private response header: " + path);
  check(privateHeader.headers.some(header => header.value.includes("noindex") && header.value.includes("nosnippet")), "Private HTTP responses opt out of indexing and snippets");

  const hero = readFileSync(resolve("src/components/landing/LandingHero.tsx"), "utf8");
  check(hero.includes("Logiciel de gestion et ERP pour les PME au Maroc") && hero.includes("Maîtrisez vos coûts. Mesurez vos performances."), "Homepage H1 names the product and lead uses the approved cost/performance message");
  check(hero.includes("felexia-horizon-v1.avif") && hero.includes("felexia-horizon-v1.webp") && !hero.includes("felexia-horizon-v1.png"), "Hero references the modern images, not the multi-megabyte PNG");
  check(readFileSync(resolve("src/components/landing/LandingStory.tsx"), "utf8").includes("HOME_FAQS"), "Homepage FAQ is rendered from the structured-data source");
  for (const file of ["src/lib/app-url.ts", "src/app/auth/google/route.ts", "src/app/auth/callback/route.ts"]) {
    const before = execFileSync("git", ["show", "HEAD:" + file]);
    const after = readFileSync(resolve(file));
    check(before.toString("utf8").replace(/\r\n/g, "\n") === after.toString("utf8").replace(/\r\n/g, "\n"), "OAuth source remains unchanged, modulo EOL: " + file);
  }
  check(createHash("sha256").update(readFileSync(resolve("public/google9cbdd88855e0d08d.html"))).digest("hex") === GOOGLE_OWNERSHIP_SHA256, "Google ownership file retains the exact public baseline bytes");
  mkdirSync(resolve("training/seo/20261101"), { recursive: true });
  writeFileSync(resolve("training/seo/20261101/seo-fixtures.json"), JSON.stringify({ passed: true, assertions: results.length, scope: "Local source/Next configuration only. No network, authentication, account, database or Google operation.", results }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, assertions: results.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
