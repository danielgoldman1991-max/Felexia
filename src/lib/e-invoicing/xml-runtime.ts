import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { EInvoiceSourceType, EInvoiceXmlValidation } from "./types";

const BASE = "https://felexia.invalid/pinned-ubl-2.1/";
export const C14N_ALGORITHM = "http://www.w3.org/2006/12/xml-c14n11" as const;
export const XML_LIMIT_BYTES = 2000000;
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
type Manifest = { version: string; files: { path: string; sha256: string; bytes: number }[] };
let initialization: ReturnType<typeof initialize> | undefined;

async function initialize() {
  const lib = await import("libxml2-wasm");
  const directory = join(process.cwd(), "src/lib/e-invoicing/schemas/ubl-2.1");
  const manifestBytes = await readFile(join(directory, "manifest.json"));
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as Manifest;
  if (manifest.version !== "OASIS-UBL-2.1-OS-2013-11-04" || manifest.files.length !== 15) throw new Error("UBL_SCHEMA_MANIFEST_INVALID");
  const buffers = new Map<string, Uint8Array>();
  for (const file of manifest.files) {
    if (!/^(?:maindoc|common)\/[A-Za-z0-9_.-]+\.xsd$/.test(file.path)) throw new Error("UBL_SCHEMA_PATH_INVALID");
    const bytes = await readFile(join(directory, file.path));
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error("UBL_SCHEMA_INTEGRITY_FAILED");
    buffers.set(BASE + file.path, bytes);
  }
  const denied: string[] = [];
  if (!lib.xmlRegisterInputProvider({
    match: () => true,
    open(filename) {
      const bytes = buffers.get(filename);
      if (!bytes) { denied.push("EXTERNAL_RESOURCE_REFUSED"); return undefined; }
      return lib.openBuffer(bytes);
    },
    read: lib.readBuffer,
    close(fd) { lib.closeBuffer(fd); return true; },
  })) throw new Error("UBL_RESOURCE_LOADER_UNAVAILABLE");
  const parsers = {} as Record<EInvoiceSourceType, InstanceType<typeof lib.XsdValidator>>;
  for (const [kind, name] of [["customer_invoice", "Invoice"], ["customer_credit_note", "CreditNote"]] as const) {
    const url = BASE + "maindoc/UBL-" + name + "-2.1.xsd";
    const doc = lib.XmlDocument.fromBuffer(buffers.get(url)!, { url, option: lib.ParseOption.XML_PARSE_NONET | lib.ParseOption.XML_PARSE_NO_XXE | lib.ParseOption.XML_PARSE_NO_SYS_CATALOG });
    try { parsers[kind] = lib.XsdValidator.fromDoc(doc); } finally { doc.dispose(); }
  }
  if (denied.length) throw new Error("UBL_SCHEMA_IMPORT_REFUSED");
  return { lib, parsers, manifestHash: digest(manifestBytes), denied };
}

function guardXml(xml: string) {
  if (typeof xml !== "string" || Buffer.byteLength(xml, "utf8") > XML_LIMIT_BYTES || (xml.match(/</g)?.length || 0) > 50000) throw new Error("XML_RESOURCE_LIMIT");
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error("XML_DTD_FORBIDDEN");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff\ud800-\udfff]/u.test(xml)) throw new Error("XML_CHARACTER_INVALID");
}

export async function canonicalizeXml(xml: string): Promise<string> {
  guardXml(xml);
  const runtime = await (initialization ??= initialize());
  const doc = runtime.lib.XmlDocument.fromString(xml, { option: runtime.lib.ParseOption.XML_PARSE_NONET | runtime.lib.ParseOption.XML_PARSE_NO_XXE | runtime.lib.ParseOption.XML_PARSE_NO_SYS_CATALOG });
  try { return doc.canonicalizeToString({ mode: runtime.lib.XmlC14NMode.XML_C14N_1_1, withComments: false }); }
  finally { doc.dispose(); }
}

export async function validateUblXml(xml: string, sourceType: EInvoiceSourceType): Promise<EInvoiceXmlValidation> {
  const schema = sourceType === "customer_invoice" ? "UBL-Invoice-2.1" : "UBL-CreditNote-2.1";
  let manifestHash = "";
  try {
    guardXml(xml);
    const runtime = await (initialization ??= initialize());
    manifestHash = runtime.manifestHash;
    const doc = runtime.lib.XmlDocument.fromString(xml, { option: runtime.lib.ParseOption.XML_PARSE_NONET | runtime.lib.ParseOption.XML_PARSE_NO_XXE | runtime.lib.ParseOption.XML_PARSE_NO_SYS_CATALOG });
    try { runtime.parsers[sourceType].validate(doc); }
    finally { doc.dispose(); }
    return { valid: true, schema, errors: [], schemaManifestSha256: manifestHash, schema_sha256: manifestHash, engine: "libxml2-wasm-0.7.2" };
  } catch (error) {
    // Never return full XML, entity URLs or parser input values in diagnostics.
    const safe = error instanceof Error && /^(?:XML_RESOURCE_LIMIT|XML_DTD_FORBIDDEN|XML_CHARACTER_INVALID|UBL_[A-Z_]+)$/.test(error.message) ? error.message : "XML_XSD_INVALID";
    return { valid: false, schema, errors: [safe], schemaManifestSha256: manifestHash, schema_sha256: manifestHash, engine: "libxml2-wasm-0.7.2" };
  }
}

export async function xmlRuntimeDiagnostics() {
  const runtime = await (initialization ??= initialize());
  return { engine: "libxml2-wasm-0.7.2", schemaCount: 15, schemaManifestSha256: runtime.manifestHash, externalResourceAttempts: runtime.denied.length, networkRequests: 0 };
}
