import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { readAllPages } from "@/lib/listing";
import type { EInvoiceNormalizedSnapshot, EInvoiceSnapshotInput } from "./types";
import { EInvoiceError, uuid } from "./access";

export type EinvoiceDocumentRow = { id: string; organization_id: string; source_kind: "invoice" | "credit_note"; source_id: string; source_number: string; source_date: string; currency: string; status: string; simulation_status: string; current_version_id: string | null; current_version_number: number; issued_at: string | null; created_at: string; updated_at: string };
export type EinvoiceVersionRow = { id: string; organization_id: string; document_id: string; version_number: number; source_fingerprint: string; configuration_fingerprint: string; snapshot: EInvoiceNormalizedSnapshot | EInvoiceSnapshotInput; canonical_snapshot: string; snapshot_sha256: string; profile_version: string; created_at: string };
export type EinvoiceArtifactRow = { id: string; organization_id: string; document_id: string; version_id: string; format: "xml" | "pdf"; mime_type: string; byte_length: number; sha256: string; canonical_sha256: string | null; created_at: string };
export type EinvoiceValidationRow = { id: string; version_id: string; valid: boolean; result: { valid: boolean; issues: { code: string; message: string; severity: "error" | "warning"; path?: string }[]; xsd?: { valid: boolean; engine?: string; schema_sha256?: string } }; created_at: string };
export type EinvoiceEventRow = { id: string; organization_id: string; document_id: string | null; sequence: number; actor_id: string | null; event: string; severity: "info" | "warning" | "error"; metadata: Record<string, unknown>; previous_hash: string | null; event_hash: string; created_at: string };
export type EinvoiceJobRow = { id: string; organization_id: string; document_id: string; version_id: string; transmission_id: string; scenario: "accept" | "reject" | "timeout" | "unavailable"; status: string; attempts: number; available_at: string; lease_token: string | null; lease_expires_at: string | null; error_code: string | null; created_at: string; completed_at: string | null };

export const DOCUMENT_FIELDS = "id,organization_id,source_kind,source_id,source_number,source_date,currency,status,simulation_status,current_version_id,current_version_number,issued_at,created_at,updated_at";
export const ARTIFACT_FIELDS = "id,organization_id,document_id,version_id,format,mime_type,byte_length,sha256,canonical_sha256,created_at";

/** Every caller supplies a server-derived tenant. No user query controls tables. */
export async function readEinvoiceRows<T>(client: SupabaseClient, table: string, fields: string, organizationId: string, documentId?: string): Promise<T[]> {
  const rows = await readAllPages<Record<string, unknown>>(async (from, to) => {
    let query = client.from(table).select(fields).eq("organization_id", organizationId);
    if (documentId) query = query.eq("document_id", documentId);
    const result = await query.order("id", { ascending: true }).range(from, to);
    return { data: result.data as unknown as Record<string, unknown>[] | null, error: result.error };
  });
  return rows as T[];
}

export async function getEinvoiceDocument(client: SupabaseClient, organizationId: string, documentId: string) {
  const { data, error } = await client.from("einvoice_documents").select(DOCUMENT_FIELDS).eq("organization_id", organizationId).eq("id", uuid(documentId)).maybeSingle();
  if (error || !data) throw new EInvoiceError("DOCUMENT_NOT_FOUND", "Document électronique introuvable.", 404);
  return data as unknown as EinvoiceDocumentRow;
}

export async function currentEinvoiceVersion(client: SupabaseClient, document: EinvoiceDocumentRow, expectedId?: string) {
  if (!document.current_version_id || expectedId && expectedId !== document.current_version_id) throw new EInvoiceError("STALE_VERSION", "La pièce a changé. Rechargez la page avant de poursuivre.", 409);
  const { data, error } = await client.from("einvoice_versions").select("*").eq("organization_id", document.organization_id).eq("document_id", document.id).eq("id", document.current_version_id).maybeSingle();
  if (error || !data) throw new EInvoiceError("VERSION_NOT_FOUND", "La version préparée n’est pas disponible.", 404);
  return data as unknown as EinvoiceVersionRow;
}

export async function appendEinvoiceAudit(actor: string, organizationId: string, documentId: string | null, event: string, severity: "info" | "warning" | "error", metadata: Record<string, unknown>) {
  const service = createServiceClient();
  const { data, error } = await service.rpc("einvoice_audit_append", { p_actor: uuid(actor), p_organization_id: uuid(organizationId), p_document_id: documentId ? uuid(documentId) : null, p_event: event, p_severity: severity, p_metadata: metadata });
  if (error) {
    console.error("[einvoice] audit write failed", { event, code: error.code });
    throw new EInvoiceError("AUDIT_UNAVAILABLE", "La preuve de cette opération n’a pas pu être enregistrée.", 503);
  }
  return data as string;
}

export async function getEinvoiceArtifact(client: SupabaseClient, organizationId: string, sourceKind: "invoice" | "credit_note", sourceId: string, format: "pdf" | "xml", versionId?: string) {
  const { data, error } = await client.from("einvoice_documents").select(DOCUMENT_FIELDS).eq("organization_id", organizationId).eq("source_kind", sourceKind).eq("source_id", uuid(sourceId)).maybeSingle();
  if (error || !data) throw new EInvoiceError("ARTIFACT_NOT_FOUND", "Aucune archive n’est disponible pour cette pièce.", 404);
  const document = data as unknown as EinvoiceDocumentRow;
  const requestedVersion = versionId ? uuid(versionId) : document.current_version_id;
  if (!requestedVersion) throw new EInvoiceError("ARTIFACT_NOT_FOUND", "Aucune version n’est disponible.", 404);
  const { data: meta, error: metaError } = await client.from("einvoice_artifacts").select(ARTIFACT_FIELDS).eq("organization_id", organizationId).eq("document_id", document.id).eq("version_id", requestedVersion).eq("format", format).maybeSingle();
  if (metaError || !meta) throw new EInvoiceError("ARTIFACT_NOT_FOUND", "Cette version ne contient pas le fichier demandé.", 404);
  const { data: artifact, error: artifactError } = await client.rpc("einvoice_get_artifact", { p_artifact_id: meta.id });
  if (artifactError || !artifact || artifact.document_id !== document.id || artifact.version_id !== requestedVersion || artifact.format !== format) throw new EInvoiceError("ARTIFACT_UNAVAILABLE", "Le téléchargement de l’archive a échoué.", 503);
  return { document, artifact: artifact as { id: string; version_id: string; document_id: string; format: "xml" | "pdf"; content_base64: string; sha256: string; canonical_sha256: string | null; mime_type: string; byte_length: number } };
}
