// Build artifacts only. No credentials, network or hosted deployment.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

let checks = 0;
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks++; };
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const fontManifest = JSON.parse(await readFile(resolve("src/lib/e-invoicing/assets/font-manifest.json"), "utf8"));
const businessFonts = ["notosans.ttf", "notonaskharabic.ttf"].map(file => {
  const entries = fontManifest.fonts.filter(font => font.file === file);
  equal(entries.length, 1, file + " has exactly one checksum manifest entry");
  return { suffix: "src/lib/e-invoicing/assets/" + file, ...entries[0] };
});
const geist = {
  suffix: "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
  bytes: 125956,
  sha256: "bde046ddd9f20be35b0bd56cc79eb752b967fb6661a3fe76cb067bb09f871d76",
};
const hasSuffix = (name, suffix) => name === suffix || name.endsWith("/" + suffix);
async function verifyAsset(file, files, expected) {
  const matches = files.filter(name => hasSuffix(name, expected.suffix));
  equal(matches.length, 1, file + " traces exactly one " + expected.suffix);
  const bytes = await readFile(resolve(dirname(file), matches[0]));
  equal(bytes.length, expected.bytes, expected.suffix + " has its expected byte length");
  equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, expected.suffix + " has its expected SHA-256");
}
const manifestChecks = checks;
const targets = [
  ".next/server/app/facturation/electronique/[kind]/[sourceId]/page.js.nft.json",
  ".next/server/app/facturation/electronique/configuration/page.js.nft.json",
  ".next/server/app/facturation/electronique/supervision/page.js.nft.json",
  ".next/server/app/api/cron/e-invoicing/route.js.nft.json",
];
const results = [];
for (const target of targets) {
  const before = checks;
  const file = resolve(target);
  const trace = JSON.parse(await readFile(file, "utf8"));
  const files = trace.files.map(name => name.replaceAll("\\", "/"));
  const xsd = files.filter(name => name.endsWith(".xsd"));
  const fonts = files.filter(name => name.endsWith(".ttf"));
  const manifest = files.filter(name => name.endsWith("ubl-2.1/manifest.json"));
  const wasm = files.filter(name => name.endsWith("libxml2-wasm/lib/libxml2raw.mjs"));
  equal(xsd.length, 15, target + " must contain the complete XSD graph");
  equal(manifest.length, 1, target + " must contain the schema checksum manifest");
  for (const font of businessFonts) await verifyAsset(file, fonts, font);
  const extraFonts = fonts.filter(name => !businessFonts.some(font => hasSuffix(name, font.suffix)));
  ok(extraFonts.every(name => hasSuffix(name, geist.suffix)), target + " permits only Next ImageResponse's identified Geist font in addition to the two business fonts");
  ok(extraFonts.length <= 1, target + " must not trace duplicate additional fonts");
  if (extraFonts.length) await verifyAsset(file, extraFonts, geist);
  equal(wasm.length, 1, target + " must contain the embedded WASM runtime");
  const runtime = await readFile(resolve(dirname(file), wasm[0]), "utf8");
  ok(runtime.includes("WebAssembly"), "libxml2 ships WASM embedded in its JavaScript, with no separate .wasm file");
  for (const asset of [...xsd, ...fonts, ...manifest, ...wasm]) ok((await stat(resolve(dirname(file), asset))).size > 0, "traced asset is present");
  results.push({ route: target, xsd: xsd.length, unicodeFonts: businessFonts.length, additionalNextFonts: extraFonts.length, schemaManifest: true, embeddedWasm: true, checks: checks - before });
}
const ogTarget = ".next/server/app/opengraph-image/route.js.nft.json";
const beforeOg = checks;
const ogFile = resolve(ogTarget);
const ogTrace = JSON.parse(await readFile(ogFile, "utf8"));
const ogFiles = ogTrace.files.map(name => name.replaceAll("\\", "/"));
const ogFonts = ogFiles.filter(name => name.endsWith(".ttf"));
equal(ogFonts.length, 1, "the OG route traces only its identified Next font");
await verifyAsset(ogFile, ogFonts, geist);
await verifyAsset(ogFile, ogFiles, {
  suffix: "public/brand/felexiaerp-logo-horizontal.png",
  bytes: 92404,
  sha256: "f39da2dfd3d4ca815204e171fab7512cc931b218b2b0fc63065a8214051b5080",
});
results.push({ route: ogTarget, nextFonts: 1, brandLogo: true, checks: checks - beforeOg });
const report = { passed: true, node: process.version, checks, manifestChecks, results, hostedVercelDeployment: false };
await writeFile(new URL("build-tracing.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
