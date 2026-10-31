// Build artifacts only. No credentials, network or hosted deployment.
import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const targets = [
  ".next/server/app/facturation/electronique/[kind]/[sourceId]/page.js.nft.json",
  ".next/server/app/facturation/electronique/configuration/page.js.nft.json",
  ".next/server/app/facturation/electronique/supervision/page.js.nft.json",
  ".next/server/app/api/cron/e-invoicing/route.js.nft.json",
];
const results = [];
for (const target of targets) {
  const file = resolve(target);
  const trace = JSON.parse(await readFile(file, "utf8"));
  const files = trace.files.map(name => name.replaceAll("\\", "/"));
  const xsd = files.filter(name => name.endsWith(".xsd"));
  const fonts = files.filter(name => name.endsWith(".ttf"));
  const manifest = files.filter(name => name.endsWith("ubl-2.1/manifest.json"));
  const wasm = files.filter(name => name.endsWith("libxml2-wasm/lib/libxml2raw.mjs"));
  assert.equal(xsd.length, 15, target + " must contain the complete XSD graph");
  assert.equal(manifest.length, 1, target + " must contain the schema checksum manifest");
  assert.equal(fonts.length, 2, target + " must contain both Unicode fonts");
  assert.equal(wasm.length, 1, target + " must contain the embedded WASM runtime");
  const runtime = await readFile(resolve(dirname(file), wasm[0]), "utf8");
  assert.ok(runtime.includes("WebAssembly"), "libxml2 ships WASM embedded in its JavaScript, with no separate .wasm file");
  for (const asset of [...xsd, ...fonts, ...manifest, ...wasm]) assert.ok((await stat(resolve(dirname(file), asset))).size > 0, "traced asset is present");
  results.push({ route: target, xsd: xsd.length, unicodeFonts: fonts.length, schemaManifest: true, embeddedWasm: true, checks: 5 + xsd.length + fonts.length + manifest.length + wasm.length });
}
const report = { passed: true, node: process.version, checks: results.reduce((sum, row) => sum + row.checks, 0), results, hostedVercelDeployment: false };
await writeFile(new URL("build-tracing.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
