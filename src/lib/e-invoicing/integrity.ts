import { createHash } from "node:crypto";
import { EInvoiceError, type EinvoiceContext } from "./access";
import { canonicalSnapshotJson } from "./ubl";
import { canonicalizeXml, validateUblXml } from "./xml-runtime";
import { appendEinvoiceAudit, getEinvoiceArtifact, type EinvoiceDocumentRow, type EinvoiceVersionRow } from "./repository";
import { createEinvoiceAlert } from "./regulatory";

export const einvoiceSha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export function verifiedArtifactBytes(artifact: { content_base64: string; byte_length: number; sha256: string }) {
  if (typeof artifact.content_base64 !== "string" || artifact.content_base64.length > 6_000_000) throw new EInvoiceError("ARCHIVE_INTEGRITY_FAILED", "Archive illisible ou trop volumineuse.", 409);
  const bytes = Buffer.from(artifact.content_base64, "base64");
  if (bytes.length !== artifact.byte_length || einvoiceSha256(bytes) !== artifact.sha256) throw new EInvoiceError("ARCHIVE_INTEGRITY_FAILED", "L’empreinte de cette archive ne correspond pas à son contenu.", 409);
  return bytes;
}

/** PostgREST's bytea wire representation; never parse arbitrary object buffers. */
export function verifiedDatabaseArtifactBytes(artifact: { content: unknown; byte_length: number; sha256: string }) {
  if (typeof artifact.content !== "string" || !/^\\x(?:[0-9a-f]{2})+$/i.test(artifact.content) || artifact.content.length > 8_388_610) throw new EInvoiceError("ARCHIVE_INTEGRITY_FAILED", "Archive binaire illisible.", 409);
  const bytes = Buffer.from(artifact.content.slice(2), "hex");
  if (bytes.length !== artifact.byte_length || einvoiceSha256(bytes) !== artifact.sha256) throw new EInvoiceError("ARCHIVE_INTEGRITY_FAILED", "Archive binaire corrompue.", 409);
  return bytes;
}

/** Explicit administrator operation. Downloads independently verify their raw hash. */
export async function checkEinvoiceVersionIntegrity(c: EinvoiceContext, document: EinvoiceDocumentRow, version: EinvoiceVersionRow) {
  const checks: Record<string, boolean> = {};
  const canonical = canonicalSnapshotJson(version.snapshot);
  checks.snapshot_digest = canonical === version.canonical_snapshot && einvoiceSha256(canonical) === version.snapshot_sha256;
  for (const format of ["xml", "pdf"] as const) {
    try {
      const { artifact } = await getEinvoiceArtifact(c.client, c.workspace.organization.id, document.source_kind, document.source_id, format, version.id);
      const bytes = verifiedArtifactBytes(artifact);
      checks[`${format}_archive`] = format === "pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" : true;
      if (format === "xml") {
        const xml = bytes.toString("utf8");
        checks.xsd = (await validateUblXml(xml, version.snapshot.sourceType)).valid;
        checks.canonical_xml = einvoiceSha256(await canonicalizeXml(xml)) === artifact.canonical_sha256;
      }
    } catch { checks[`${format}_archive`] = false; }
  }
  const ok = Object.values(checks).every(Boolean);
  await appendEinvoiceAudit(c.workspace.userId, c.workspace.organization.id, document.id, "archive.integrity_checked", ok ? "info" : "error", { version_id: version.id, ok, checks, snapshot_sha256: version.snapshot_sha256 });
  if (!ok) await createEinvoiceAlert(c.workspace.organization.id, `integrity:${version.id}`, "Intégrité d’une archive à vérifier", "Une vérification a détecté une incohérence. Consultez la supervision et le justificatif de sauvegarde avant toute utilisation du document.", c.settings?.configuration.alerts_enabled !== false);
  return { ok, checks };
}
