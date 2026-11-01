import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PUBLIC_SITE_ORIGIN, PUBLIC_SITE_PATHS, isPublicSitePath } from "../../../src/lib/public-site";
import { ROOT_METADATA, canonicalUrl, createPublicMetadata, getSiteStructuredData, getSoftwareApplicationStructuredData, serializeJsonLd, SEO_CONTENT_UPDATED_AT } from "../../../src/lib/seo";
import sitemap from "../../../src/app/sitemap";
import robots from "../../../src/app/robots";

const results: string[] = [];
function check(value: unknown, name: string) { assert.ok(value, name); results.push(name); }
const object = (value: unknown) => value as Record<string, unknown>;
const GOOGLE_OWNERSHIP_SHA256 = "24d198949233f761310ad02311e9ff611f1bcfdd451218612cf0bbbd1a7a8412";

async function main() {
  check(PUBLIC_SITE_ORIGIN === "https://www.felexia.pro", "SEO and public consent use the fixed production www origin");
  check(PUBLIC_SITE_PATHS.length === 7 && new Set(PUBLIC_SITE_PATHS).size === 7, "Seven public routes are explicit and unique");
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
  check(JSON.stringify(map.map(entry => entry.url)) === JSON.stringify(PUBLIC_SITE_PATHS.map(canonicalUrl)), "Sitemap includes only the seven public canonical routes");
  check(map.every(entry => entry.lastModified === SEO_CONTENT_UPDATED_AT), "Sitemap dates describe the content, not crawler/build time");
  check(robots().sitemap === PUBLIC_SITE_ORIGIN + "/sitemap.xml", "Robots advertises the www sitemap");
  const rules = object(robots().rules);
  check(JSON.stringify(rules.disallow) === JSON.stringify(["/api/", "/auth/"]), "Only action/API endpoints are excluded from crawling; login noindex stays observable");

  const site = getSiteStructuredData();
  check(site["@graph"].some(node => node["@type"] === "Organization") && site["@graph"].some(node => node["@type"] === "WebSite"), "Organization and WebSite describe the real brand");
  check(site["@graph"].every(node => node.url === PUBLIC_SITE_ORIGIN + "/"), "Structured site identities use the same www origin");
  const app = getSoftwareApplicationStructuredData();
  check(app["@type"] === "SoftwareApplication" && app.applicationCategory === "BusinessApplication", "Software describes business management");
  check(JSON.stringify(app.offers.map(offer => offer.price)) === "[99,1188]", "Only the approved ESSENTIEL prices are encoded");
  check(app.offers.every(offer => offer.name.startsWith("ESSENTIEL") && offer.priceCurrency === "MAD" && offer.priceSpecification.valueAddedTaxIncluded === false), "PRO has no invented price and ESSENTIEL amounts explicitly exclude tax");
  check(JSON.stringify(app.offers.map(offer => offer.priceSpecification.billingDuration)) === '["P1M","P1Y"]', "Monthly and annual billing intervals are distinct");
  check(app.description.includes("15 jours") && app.description.includes("sans carte bancaire") && app.description.includes("PRO est disponible uniquement sur devis"), "Trial and quote-only PRO match the public product");
  check(!/"aggregateRating"|"review"|"address"|"legalName"/.test(JSON.stringify([site, app])), "No rating, review, legal identity or address is invented");
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
  check(hero.includes("Prenez de la hauteur. Pilotez en toute liberté.") && hero.includes("ESSENTIEL au quotidien. PRO pour une vue d’ensemble."), "User-approved hero wording is preserved");
  for (const file of ["src/lib/app-url.ts", "src/app/auth/google/route.ts", "src/app/auth/callback/route.ts", "src/components/landing/LandingHero.tsx"]) {
    // Useful before committing locally; CI's HEAD comparison is not a release
    // boundary. Publication separately compares the full tree to production.
    const before = execFileSync("git", ["show", "HEAD:" + file]);
    const after = readFileSync(resolve(file));
    check(before.toString("utf8").replace(/\r\n/g, "\n") === after.toString("utf8").replace(/\r\n/g, "\n"), "OAuth/hero source remains byte-identical modulo EOL: " + file);
  }
  check(createHash("sha256").update(readFileSync(resolve("public/google9cbdd88855e0d08d.html"))).digest("hex") === GOOGLE_OWNERSHIP_SHA256, "Google ownership file retains the exact public baseline bytes");
  mkdirSync(resolve("training/seo/20261101"), { recursive: true });
  writeFileSync(resolve("training/seo/20261101/seo-fixtures.json"), JSON.stringify({ passed: true, assertions: results.length, scope: "Local source/Next configuration only. No network, authentication, account, database or Google operation.", results }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: true, assertions: results.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
