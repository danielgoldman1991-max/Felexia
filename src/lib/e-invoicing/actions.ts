"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { EInvoiceError, assertEinvoiceWrite, assertEinvoiceConfiguration, getEinvoiceContext, safeEinvoiceError, sourceKind, sourceRoute, uuid, type EinvoiceContext } from "./access";
import { captureEinvoiceSource, mapEinvoiceCapture, parseEinvoiceOptions } from "./source";
import { canonicalSnapshotJson, prepareEInvoice } from "./ubl";
import { validateEInvoiceSnapshot } from "./validation";
import { generateEInvoicePdf } from "./pdf";
import { appendEinvoiceAudit, currentEinvoiceVersion, getEinvoiceDocument, readEinvoiceRows, type EinvoiceEventRow } from "./repository";
import { einvoiceSha256, checkEinvoiceVersionIntegrity } from "./integrity";
import { processEinvoiceJobs } from "./jobs";
import { checkOfficialEinvoiceSources, validateRegulatoryReview } from "./regulatory";

const base = "/facturation/electronique";
type Operation = (c: EinvoiceContext) => Promise<"generated" | "issued" | "saved" | void>;

function rpcError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  const code = error.message?.match(/EINVOICE_[A-Z_]+|SUBSCRIPTION_WRITE_REQUIRED/)?.[0];
  if (code) throw new EInvoiceError(code, "L’opération a été refusée. Rechargez la pièce et vérifiez les contrôles affichés.", error.code === "42501" ? 403 : 409);
  throw new EInvoiceError("OPERATION_UNAVAILABLE", "L’opération est temporairement indisponible.", 503);
}

async function run(form: FormData, location: "detail" | "configuration" | "supervision", operation: Operation) {
  // Authentication redirects must remain outside the business-error catch.
  const c = await getEinvoiceContext();
  let path = location === "detail" ? base : `${base}/${location}`;
  let errorCode: string | undefined;
  let notice = "saved";
  try {
    if (location === "detail") path = sourceRoute(sourceKind(form.get("sourceKind")), uuid(form.get("sourceId")));
    notice = await operation(c) ?? "saved";
  } catch (error) {
    errorCode = error instanceof EInvoiceError ? error.code : error instanceof Error && /^EINVOICE_[A-Z_]+$/.test(error.message) ? error.message : "OPERATION_UNAVAILABLE";
    safeEinvoiceError(error);
    // Persist bounded diagnostics only. Never log posted identities, XML, PDF or secrets.
    try {
      let documentId: string | null = null;
      if (form.get("documentId")) documentId = (await getEinvoiceDocument(c.client, c.workspace.organization.id, uuid(form.get("documentId")))).id;
      if (c.migrationReady && (documentId || c.canAdmin)) await appendEinvoiceAudit(c.workspace.userId, c.workspace.organization.id, documentId, "operation.failed", errorCode === "PREPARATION_INCOMPLETE" ? "warning" : "error", { error_code: errorCode, operation: location });
    } catch { console.error("[einvoice] failure audit unavailable", { code: errorCode }); }
  }
  revalidatePath(base, "layout");
  const query = new URLSearchParams({ lang: form.get("lang") === "ar" ? "ar" : "fr", ...(errorCode ? { error: errorCode } : { notice }) });
  redirect(`${path}?${query}`);
}

async function submittedDocument(c: EinvoiceContext, form: FormData) {
  const document = await getEinvoiceDocument(c.client, c.workspace.organization.id, uuid(form.get("documentId")));
  if (document.source_kind !== sourceKind(form.get("sourceKind")) || document.source_id !== uuid(form.get("sourceId"))) throw new EInvoiceError("INVALID_SOURCE", "La pièce ne correspond pas à la demande.", 409);
  const version = await currentEinvoiceVersion(c.client, document, uuid(form.get("versionId")));
  return { document, version };
}

export async function prepareEinvoiceAction(form: FormData): Promise<void> {
  return run(form, "detail", async c => {
    assertEinvoiceWrite(c);
    const kind = sourceKind(form.get("sourceKind")), id = uuid(form.get("sourceId"));
    const captured = await captureEinvoiceSource(c.client, kind, id, c.workspace.organization.id);
    if (!captured.eligible) throw new EInvoiceError("SOURCE_INVALID_STATE", "Validez d’abord la facture ou l’avoir dans la facturation habituelle.", 409);
    const input = mapEinvoiceCapture(captured), options = parseEinvoiceOptions(form, input, captured.configuration);
    const checked = validateEInvoiceSnapshot(input, options);
    const previousId = form.get("documentId");
    let expectedVersion: number | null = null;
    if (previousId) {
      const document = await getEinvoiceDocument(c.client, c.workspace.organization.id, uuid(previousId));
      if (document.source_kind !== kind || document.source_id !== id) throw new EInvoiceError("INVALID_SOURCE", "La pièce ne correspond pas à la demande.", 409);
      // A retry of the same generation must reach SQL's idempotency check even
      // after its first submission advanced the current version. A different
      // key still encounters SQL's expected-version comparison and is refused.
      const { data: expected, error: expectedError } = await c.client.from("einvoice_versions").select("version_number").eq("organization_id", c.workspace.organization.id).eq("document_id", document.id).eq("id", uuid(form.get("versionId"))).maybeSingle();
      if (expectedError || !expected) throw new EInvoiceError("STALE_VERSION", "Cette version n’est plus disponible. Actualisez la pièce.", 409);
      expectedVersion = expected.version_number;
    }
    const language = form.get("lang") === "ar" ? "ar" : "fr";
    const started = performance.now();
    let snapshot = checked.snapshot ?? input;
    let validation: Record<string, unknown> = { valid: false, issues: checked.issues, xsd: { valid: false, notRun: true } };
    const artifacts: Record<string, unknown>[] = [];
    if (checked.valid) {
      try {
        const prepared = await prepareEInvoice(input, options);
        snapshot = prepared.snapshot;
        const pdf = await generateEInvoicePdf(prepared.snapshot, { language, snapshotSha256: prepared.snapshotSha256 });
        const xml = Buffer.from(prepared.xml, "utf8");
        artifacts.push({ format: "xml", mime_type: "application/xml", content_base64: xml.toString("base64"), sha256: prepared.xmlSha256, canonical_sha256: prepared.canonicalSha256 },
          { format: "pdf", mime_type: "application/pdf", content_base64: pdf.toString("base64"), sha256: einvoiceSha256(pdf) });
        validation = { valid: prepared.validation.valid, issues: prepared.issues, xsd: prepared.validation, canonicalization_algorithm: prepared.canonicalizationAlgorithm };
      } catch (error) {
        const xsdFailure = error instanceof Error && error.message === "EINVOICE_XSD_VALIDATION_FAILED";
        const layoutFailure = error instanceof Error && /^EINVOICE_PDF_(?:LINE_TOO_LONG|IDENTITY_TOO_LONG|PAGE_LIMIT)$/.test(error.message);
        validation = { valid: false, issues: [...checked.issues, { code: xsdFailure ? "XML_XSD_INVALID" : layoutFailure ? "PDF_LAYOUT_LIMIT" : "ARTIFACT_GENERATION_FAILED", message: xsdFailure ? "Le XML généré n’a pas passé le contrôle de schéma. Aucune archive valide n’a été émise." : layoutFailure ? "Une coordonnée ou une désignation est trop longue, ou la pièce dépasse 100 pages. Réduisez le contenu avant de préparer à nouveau ; aucune donnée n’a été tronquée." : "La génération des archives est indisponible. Corrigez l’incident avant de préparer à nouveau.", severity: "error", source: "technical", path: "" }],
          xsd: { valid: false, notRun: !xsdFailure }, generation_failed: true };
      }
    }
    const { data: stored, error } = await createServiceClient().rpc("einvoice_save_preparation", { p_actor: c.workspace.userId, p_source_kind: kind, p_source_id: id,
      p_source_fingerprint: captured.source_fingerprint, p_snapshot: snapshot, p_canonical_snapshot: canonicalSnapshotJson(snapshot),
      p_validation: { ...validation, configuration_fingerprint: captured.configuration_fingerprint, preparation_options: options, pdf_language: language, duration_ms: Math.round(performance.now() - started), signed: false, official_conformity: false },
      p_artifacts: artifacts, p_profile_version: "felexia-einvoice-v1", p_expected_version: expectedVersion, p_idempotency_key: uuid(form.get("idempotencyKey")) });
    rpcError(error);
    if (validation.valid !== true) throw new EInvoiceError("PREPARATION_INCOMPLETE", "Des informations doivent être corrigées avant de générer les documents. Les contrôles sont enregistrés sur cette pièce.", 422);
    // A repeated idempotency key may reuse a previously failed generation.
    // Announce success only for the validation actually committed in PostgreSQL.
    const { data: committedValidation, error: committedError } = await c.client.from("einvoice_validations").select("valid").eq("organization_id", c.workspace.organization.id).eq("version_id", uuid(stored?.version_id)).maybeSingle();
    if (committedError || committedValidation?.valid !== true) throw new EInvoiceError("PREPARATION_INCOMPLETE", "Cette préparation ne contient pas encore les documents attendus. Actualisez la page et générez une nouvelle version.", 422);
    return "generated";
  });
}

async function transition(form: FormData, target: "validated" | "issued" | "ready_to_submit") {
  return run(form, "detail", async c => {
    assertEinvoiceWrite(c);
    const { document, version } = await submittedDocument(c, form);
    const { error } = await c.client.rpc("einvoice_transition", { p_document_id: document.id, p_expected_version: version.version_number, p_target: target });
    rpcError(error);
    revalidatePath(document.source_kind === "invoice" ? "/facturation/factures" : "/facturation/avoirs", "layout");
  });
}
export async function validateEinvoiceAction(form: FormData): Promise<void> { return transition(form, "validated"); }
export async function issueEinvoiceAction(form: FormData): Promise<void> { return transition(form, "issued"); }
export async function readyEinvoiceAction(form: FormData): Promise<void> { return transition(form, "ready_to_submit"); }

/** Verify and issue this exact prepared version in one database transaction. */
export async function issueAndArchiveEinvoiceAction(form: FormData): Promise<void> {
  return run(form, "detail", async c => {
    assertEinvoiceWrite(c);
    const { document, version } = await submittedDocument(c, form);
    const { error } = await c.client.rpc("einvoice_issue_and_archive", { p_document_id: document.id, p_expected_version: version.version_number });
    rpcError(error);
    revalidatePath(document.source_kind === "invoice" ? "/facturation/factures" : "/facturation/avoirs", "layout");
    return "issued";
  });
}

export async function simulateEinvoiceAction(form: FormData): Promise<void> {
  return run(form, "detail", async c => {
    assertEinvoiceWrite(c, true);
    const { document, version } = await submittedDocument(c, form);
    const scenario = form.get("scenario") ?? "accept";
    if (!["accept", "reject", "timeout", "unavailable"].includes(String(scenario))) throw new EInvoiceError("INVALID_SIMULATION", "Scénario inconnu.");
    const { data, error } = await c.client.rpc("einvoice_enqueue_simulation", { p_document_id: document.id, p_expected_version: version.version_number, p_scenario: scenario, p_idempotency_key: uuid(form.get("idempotencyKey")) });
    rpcError(error);
    if (data?.job_id) await processEinvoiceJobs(c.workspace.organization.id, uuid(data.job_id), 1);
  });
}
export async function processEinvoiceJobsAction(form: FormData): Promise<void> {
  return run(form, "supervision", async c => { assertEinvoiceWrite(c, true); await processEinvoiceJobs(c.workspace.organization.id); });
}

export async function saveEinvoiceSettingsAction(form: FormData): Promise<void> {
  return run(form, "configuration", async c => {
    assertEinvoiceConfiguration(c);
    const mode = form.get("connectorMode"), buyer = form.get("buyerType"), language = form.get("preferredLanguage");
    if (mode !== "disabled" && mode !== "simulation") throw new EInvoiceError("DGI_OFFICIAL_SPECIFICATIONS_UNAVAILABLE", "La connexion officielle n’est pas disponible.", 403);
    if (!["business", "consumer", "export"].includes(String(buyer)) || !["fr", "ar"].includes(String(language))) throw new EInvoiceError("INVALID_SETTINGS", "Vérifiez la configuration.");
    const revision = Number(form.get("expectedRevision"));
    if (!Number.isSafeInteger(revision) || revision < 0) throw new EInvoiceError("STALE_CONFIGURATION", "Rechargez la configuration.", 409);
    const defaultUnit = form.get("defaultUnitCode");
    if (defaultUnit !== null && (typeof defaultUnit !== "string" || defaultUnit !== "" && !["C62", "HUR", "DAY", "MON", "KGM", "LTR", "MTR"].includes(defaultUnit))) throw new EInvoiceError("INVALID_UNIT", "Choisissez une unité par défaut proposée.");
    const configuration: Record<string, unknown> = { ...c.settings?.configuration, buyer_type: buyer, language, alerts_enabled: form.get("alertsEnabled") === "on", require_seller_rc: form.get("requireSellerRc") === "on" };
    // Existing clients may omit this new optional field; only a deliberate empty
    // selection clears a previously confirmed organization default.
    if (defaultUnit === "") delete configuration.default_unit_code;
    else if (typeof defaultUnit === "string") configuration.default_unit_code = defaultUnit;
    const { error } = await c.client.rpc("einvoice_update_settings", { p_organization_id: c.workspace.organization.id, p_enabled: form.get("enabled") === "on", p_mode: mode,
      p_configuration: configuration, p_expected_revision: revision });
    rpcError(error);
  });
}

export async function checkEinvoiceIntegrityAction(form: FormData): Promise<void> {
  return run(form, "detail", async c => { assertEinvoiceWrite(c, true); const { document, version } = await submittedDocument(c, form); const result = await checkEinvoiceVersionIntegrity(c, document, version); if (!result.ok) throw new EInvoiceError("ARCHIVE_INTEGRITY_FAILED", "Une incohérence a été détectée.", 409); });
}
export async function checkRegulatorySourcesAction(form: FormData): Promise<void> {
  return run(form, "configuration", async c => { assertEinvoiceConfiguration(c); const events = await readEinvoiceRows<EinvoiceEventRow>(c.client, "einvoice_events", "*", c.workspace.organization.id); await checkOfficialEinvoiceSources(c.workspace.userId, c.workspace.organization.id, events, c.settings?.configuration.alerts_enabled !== false); });
}
export async function reviewRegulatoryChangeAction(form: FormData): Promise<void> {
  return run(form, "configuration", async c => { assertEinvoiceConfiguration(c); const events = await readEinvoiceRows<EinvoiceEventRow>(c.client, "einvoice_events", "*", c.workspace.organization.id); const review = validateRegulatoryReview(form, events); await appendEinvoiceAudit(c.workspace.userId, c.workspace.organization.id, null, "regulatory.reviewed", "info", review); });
}
export async function recordBackupVerificationAction(form: FormData): Promise<void> {
  return run(form, "configuration", async c => {
    assertEinvoiceConfiguration(c);
    const date = String(form.get("verifiedAt") || ""), reference = String(form.get("backupReference") || "").trim(), notes = String(form.get("notes") || "").trim();
    if (form.get("attested") !== "on" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > new Date().toISOString().slice(0, 10) || reference.length < 3 || reference.length > 500 || notes.length < 5 || notes.length > 2000) throw new EInvoiceError("INVALID_BACKUP_ATTESTATION", "Renseignez le contrôle de restauration réellement effectué.");
    await appendEinvoiceAudit(c.workspace.userId, c.workspace.organization.id, null, "backup.attested", "info", { verified_at: date, backup_reference: reference, notes, human_attestation: true, automatically_verified: false });
  });
}
