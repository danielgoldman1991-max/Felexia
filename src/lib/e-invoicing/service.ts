import { pageRows, searchText } from "@/lib/listing";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { getEinvoiceContext, type EinvoiceContext, EInvoiceError } from "./access";
import { captureEinvoiceSource, mapEinvoiceCapture } from "./source";
import { validateEInvoiceSnapshot } from "./validation";
import { xmlRuntimeDiagnostics } from "./xml-runtime";
import { readEinvoiceRows, DOCUMENT_FIELDS, ARTIFACT_FIELDS, type EinvoiceDocumentRow, type EinvoiceValidationRow, type EinvoiceVersionRow, type EinvoiceArtifactRow, type EinvoiceEventRow, type EinvoiceJobRow } from "./repository";
import { regulatoryView } from "./regulatory";
import type { EInvoiceLineMetadata, EInvoicePreparationOptions } from "./types";
import type { EinvoiceAccess, EinvoiceConfigurationView, EinvoiceDashboardFilters, EinvoiceDashboardView, EinvoiceDetailView, EinvoiceEventView, EinvoiceListItem, EinvoiceSourceKind, EinvoiceSupervisionView } from "./view-types";

type SourceIndexRow = { id: string; organization_id: string; source_kind: EinvoiceSourceKind; source_id: string; number: string; issue_date: string; buyer_name: string; currency: string; total_ttc: string; source_status: string; archived_at: string | null };
const base = (c: EinvoiceContext): EinvoiceAccess => ({ preferredLanguage: c.settings?.configuration.language === "ar" ? "ar" : "fr", enabled: c.enabled, migrationReady: c.migrationReady, canWrite: c.canWrite, canAdmin: c.canAdmin, unavailableReason: c.unavailableReason });
const mode = (doc?: EinvoiceDocumentRow) => doc && doc.simulation_status !== "not_submitted" ? "simulation" as const : "disabled" as const;
const state = (doc?: EinvoiceDocumentRow) => !doc ? "unprepared" : doc.simulation_status !== "not_submitted" ? doc.simulation_status : doc.status === "ready_to_submit" ? "ready" : doc.status;

export function einvoiceEventView(event: EinvoiceEventRow): EinvoiceEventView {
  const labels: Record<string, string> = { "document.prepared": "Préparation enregistrée", "preparation.created": "Nouvelle version préparée", "document.validated": "Contrôles validés", "document.issued": "Document émis et figé", "document.ready_to_submit": "Document prêt à transmettre", "simulation.queued": "Traitement interne mis en attente", "simulation.accepted": "Acceptation interne simulée", "simulation.rejected": "Rejet interne simulé", "simulation.timeout": "Interruption simulée", "simulation.unavailable": "Indisponibilité simulée", "archive.integrity_checked": "Vérification d’intégrité", "regulatory.observed": "Contrôle d’une source officielle", "regulatory.reviewed": "Revue humaine d’une publication", "backup.attested": "Justificatif de sauvegarde déclaré par l’exploitant" };
  labels["operation.failed"] = "Opération refusée ou interrompue";
  labels["settings.updated"] = "Configuration mise à jour";
  const arabicLabels: Record<string, string> = { "document.prepared": "تم تسجيل الإعداد", "preparation.created": "تم إعداد نسخة جديدة", "document.validated": "تم اعتماد الفحوص", "document.issued": "تم إصدار الوثيقة وتثبيتها", "document.ready_to_submit": "الوثيقة جاهزة للإرسال", "simulation.queued": "المعالجة الداخلية في الانتظار", "simulation.accepted": "قبول داخلي بالمحاكاة", "simulation.rejected": "رفض داخلي بالمحاكاة", "simulation.timeout": "انقطاع بالمحاكاة", "simulation.unavailable": "عدم توفر بالمحاكاة", "archive.integrity_checked": "فحص سلامة الأرشيف", "regulatory.observed": "فحص مصدر رسمي", "regulatory.reviewed": "مراجعة بشرية لمنشور", "backup.attested": "تصريح المشغل بفحص النسخة الاحتياطية", "operation.failed": "عملية مرفوضة أو متوقفة", "settings.updated": "تم تحديث الإعدادات" };
  return { id: event.id, createdAt: event.created_at, label: labels[event.event] ?? event.event.replace(/[._]/g, " "), labelAr: arabicLabels[event.event], mode: event.metadata.simulation === true || event.event.startsWith("simulation.") ? "simulation" : "disabled",
    detailAr: event.metadata.error_code ? `الرمز: ${String(event.metadata.error_code).slice(0, 100)}` : event.event === "archive.integrity_checked" ? event.metadata.ok === true ? "تم فحص بصمات هذه النسخة." : "تم اكتشاف تناقض." : event.event === "backup.attested" ? "تصريح بشري، ولا يثبت استعادة سحابية آلية." : null,
    detail: event.metadata.error_code ? `Code : ${String(event.metadata.error_code).slice(0, 100)}` : event.event === "archive.integrity_checked" ? event.metadata.ok === true ? "Empreintes vérifiées pour cette version." : "Une incohérence a été détectée." : event.event === "backup.attested" ? "Déclaration humaine ; ne constitue pas une restauration cloud vérifiée automatiquement." : null };
}

async function documents(c: EinvoiceContext) { return c.migrationReady ? readEinvoiceRows<EinvoiceDocumentRow>(c.client, "einvoice_documents", DOCUMENT_FIELDS, c.workspace.organization.id) : []; }
async function history(c: EinvoiceContext) { return c.migrationReady ? readEinvoiceRows<EinvoiceEventRow>(c.client, "einvoice_events", "*", c.workspace.organization.id) : []; }

function listItem(source: SourceIndexRow, doc?: EinvoiceDocumentRow, issueCount = 0): EinvoiceListItem {
  return { sourceKind: source.source_kind, sourceId: source.source_id, documentId: doc?.id ?? null, latestVersionId: doc?.current_version_id ?? null,
    number: source.number, issueDate: source.issue_date, buyerName: source.buyer_name || "—", currency: source.currency, totalTtc: source.total_ttc,
    sourceStatus: source.source_status, status: state(doc), mode: mode(doc), issueCount };
}

export async function getEinvoiceDashboard(filters: EinvoiceDashboardFilters = {}): Promise<EinvoiceDashboardView> {
  const c = await getEinvoiceContext();
  if (!c.migrationReady) return { ...base(c), summary: { total: 0, prepared: 0, attention: 0, ready: 0 }, rows: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
  const [sources, docs, validations] = await Promise.all([
    readEinvoiceRows<SourceIndexRow>(c.client, "einvoice_source_index", "*", c.workspace.organization.id), documents(c),
    readEinvoiceRows<EinvoiceValidationRow>(c.client, "einvoice_validations", "id,version_id,valid,result,created_at", c.workspace.organization.id),
  ]);
  const bySource = new Map(docs.map(doc => [`${doc.source_kind}:${doc.source_id}`, doc]));
  const byVersion = new Map(validations.map(row => [row.version_id, row]));
  const all = sources.filter(source => !source.archived_at).map(source => {
    const doc = bySource.get(`${source.source_kind}:${source.source_id}`);
    return listItem(source, doc, byVersion.get(doc?.current_version_id ?? "")?.result.issues?.length ?? 0);
  });
  const summary = { total: all.length, prepared: all.filter(row => row.documentId).length, attention: all.filter(row => row.issueCount || ["rejected", "unknown"].includes(row.status)).length, ready: all.filter(row => row.status === "ready").length };
  const query = searchText(filters.query);
  const selected = all.filter(row => (!filters.sourceKind || filters.sourceKind === row.sourceKind) && (!query || [row.number, row.buyerName].some(value => value.toLocaleLowerCase("fr").includes(query)))
    && (!filters.status || (filters.status === "prepared" ? row.documentId != null : filters.status === "rejected" ? row.issueCount > 0 || ["rejected", "unknown"].includes(row.status) : row.status === filters.status)))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || a.sourceKind.localeCompare(b.sourceKind) || a.sourceId.localeCompare(b.sourceId));
  return { ...base(c), summary, ...pageRows(selected, filters.page ?? 1, 20) };
}

export async function getEinvoiceDetail(kind: EinvoiceSourceKind, id: string): Promise<EinvoiceDetailView> {
  const c = await getEinvoiceContext();
  const empty = { ...base(c), source: null, buyerType: null, lines: [], versions: [], issues: [], events: [], capabilities: { canPrepare: false, canValidate: false, canIssue: false, canMarkReady: false, canSimulate: false, canCheckIntegrity: false } } satisfies EinvoiceDetailView;
  if (!c.migrationReady) return empty;
  const capture = await captureEinvoiceSource(c.client, kind, id, c.workspace.organization.id);
  const input = mapEinvoiceCapture(capture);
  const { data, error } = await c.client.from("einvoice_documents").select(DOCUMENT_FIELDS).eq("organization_id", c.workspace.organization.id).eq("source_kind", kind).eq("source_id", id).maybeSingle();
  if (error) throw new EInvoiceError("DOCUMENT_UNAVAILABLE", "Le document électronique n’a pas pu être chargé.", 503);
  const doc = data as unknown as EinvoiceDocumentRow | null;
  const [versions, artifacts, validations, events] = doc ? await Promise.all([
    readEinvoiceRows<EinvoiceVersionRow>(c.client, "einvoice_versions", "*", c.workspace.organization.id, doc.id),
    readEinvoiceRows<EinvoiceArtifactRow>(c.client, "einvoice_artifacts", ARTIFACT_FIELDS, c.workspace.organization.id, doc.id),
    readEinvoiceRows<EinvoiceValidationRow>(c.client, "einvoice_validations", "id,version_id,valid,result,created_at", c.workspace.organization.id, doc.id),
    readEinvoiceRows<EinvoiceEventRow>(c.client, "einvoice_events", "*", c.workspace.organization.id, doc.id),
  ]) : [[], [], [], []];
  const latest = versions.find(row => row.id === doc?.current_version_id);
  const latestValidation = validations.find(row => row.version_id === latest?.id);
  const preparationStale = Boolean(latest && !doc?.issued_at && (latest.source_fingerprint !== capture.source_fingerprint || latest.configuration_fingerprint !== capture.configuration_fingerprint));
  const snapshot = latest?.snapshot;
  const buyerType = snapshot && "buyerType" in snapshot ? snapshot.buyerType : c.settings?.configuration.buyer_type === "consumer" ? "consumer" : c.settings?.configuration.buyer_type === "export" ? "export" : "business";
  const metadata: Record<string, EInvoiceLineMetadata> = {};
  if (snapshot && "schemaVersion" in snapshot) for (const line of snapshot.lines) metadata[line.id] = { unitCode: line.unitCode, taxCategory: line.taxCategory, exemptionReason: line.exemptionReason };
  const savedOptions = (latestValidation?.result as unknown as { preparation_options?: EInvoicePreparationOptions } | undefined)?.preparation_options;
  const options: EInvoicePreparationOptions = savedOptions ?? { buyerType, requireSellerRc: c.settings?.configuration.require_seller_rc === true, lineMetadata: metadata };
  const validation = latestValidation?.result ?? validateEInvoiceSnapshot(input, options);
  const sorted = [...events].sort((a, b) => b.sequence - a.sequence);
  const index: SourceIndexRow = { id: `${kind}:${id}`, organization_id: c.workspace.organization.id, source_kind: kind, source_id: id, number: input.number, issue_date: input.issueDate, buyer_name: doc?.issued_at && snapshot ? snapshot.buyer.name : input.buyer.name, currency: input.currency, total_ttc: input.sourceTotals.totalTtc, source_status: capture.source_status, archived_at: null };
  const canPrepare = c.canWrite && capture.eligible && !doc?.issued_at;
  return { ...base(c), source: listItem(index, doc ?? undefined, validation.issues.length), buyerType: options.buyerType,
    lines: input.lines.map(line => ({ sourceLineId: line.id, description: line.description, quantity: line.quantity, taxRate: line.taxRate,
      unitCode: options.lineMetadata?.[line.id]?.unitCode ?? null, taxCategory: options.lineMetadata?.[line.id]?.taxCategory ?? (/^0(?:\.0+)?$/.test(line.taxRate) ? null : "S"), exemptionReason: options.lineMetadata?.[line.id]?.exemptionReason ?? null })),
    issues: [...(preparationStale ? [{ code: "SOURCE_CHANGED", message: "La pièce ou ses paramètres fiscaux ont changé depuis la préparation. Préparez une nouvelle version avant de valider ou d’émettre.", messageAr: "تغيرت الوثيقة أو إعداداتها الضريبية منذ الإعداد. أعدوا إعداد نسخة جديدة قبل الاعتماد أو الإصدار.", severity: "error" as const }] : []), ...(!capture.eligible && !doc?.issued_at ? [{ code: "SOURCE_INVALID_STATE", message: "Validez d’abord la facture ou l’avoir dans la facturation habituelle pour préparer sa version électronique.", severity: "error" as const }] : []), ...validation.issues.map(row => ({ code: row.code, message: row.message, severity: row.severity, field: "path" in row ? String(row.path) : undefined }))],
    versions: [...versions].sort((a, b) => b.version_number - a.version_number).map(version => {
      const integrity = sorted.find(event => event.event === "archive.integrity_checked" && event.metadata.version_id === version.id);
      return { id: version.id, sequence: version.version_number, createdAt: version.created_at, status: doc?.issued_at && version.id === doc.current_version_id ? "issued" : "prepared", xmlAvailable: artifacts.some(row => row.version_id === version.id && row.format === "xml"), pdfAvailable: artifacts.some(row => row.version_id === version.id && row.format === "pdf"), snapshotHash: version.snapshot_sha256, integrity: integrity ? integrity.metadata.ok === true ? "verified" as const : "failed" as const : "unchecked" as const };
    }), events: sorted.map(einvoiceEventView),
    capabilities: { canPrepare, canValidate: c.canWrite && !preparationStale && doc?.status === "draft" && latestValidation?.valid === true, canIssue: c.canWrite && !preparationStale && doc?.status === "validated", canMarkReady: c.canWrite && doc?.status === "issued",
      canSimulate: c.canWrite && c.canAdmin && c.settings?.connector_mode === "simulation" && doc?.status === "ready_to_submit" && !["accepted", "pending", "queued"].includes(doc.simulation_status), canCheckIntegrity: c.canWrite && c.canAdmin && Boolean(artifacts.length) },
  };
}

export async function getEinvoiceConfiguration(): Promise<EinvoiceConfigurationView> {
  const c = await getEinvoiceContext();
  if (!c.canAdmin) throw new EInvoiceError("FORBIDDEN", "Configuration réservée à l’administrateur.", 403);
  const [issuer, events] = await Promise.all([getOrganizationDocumentIdentity(c.workspace.organization.id), history(c)]);
  const config = c.settings?.configuration ?? {};
  const regulatory = regulatoryView(events);
  const backup = events.filter(event => event.event === "backup.attested").sort((a, b) => b.sequence - a.sequence)[0];
  const issuerIssues = [!issuer.name || !issuer.address ? { code: "ISSUER_IDENTITY", message: "Complétez la raison sociale et l’adresse dans Mon entreprise.", severity: "error" as const } : null,
    !/^\d{15}$/.test(issuer.ice ?? "") ? { code: "ISSUER_ICE", message: "L’ICE de l’émetteur doit comporter quinze chiffres.", severity: "error" as const } : null,
    !issuer.ifNumber ? { code: "ISSUER_IF", message: "Complétez l’identifiant fiscal de l’émetteur.", severity: "error" as const } : null,
    config.require_seller_rc === true && !issuer.rc ? { code: "ISSUER_RC", message: "Le registre de commerce est requis par votre configuration.", severity: "error" as const } : null].filter((row): row is NonNullable<typeof row> => Boolean(row));
  return { ...base(c), canWrite: c.canAdmin && c.migrationReady && c.rolloutEnabled && c.writableSubscription,
    settings: { connectorMode: c.settings?.connector_mode ?? "disabled", preferredLanguage: config.language === "ar" ? "ar" : "fr", alertsEnabled: config.alerts_enabled !== false,
      organizationEnabled: c.settings?.enabled === true, rolloutEnabled: c.rolloutEnabled, requireSellerRc: config.require_seller_rc === true, buyerType: config.buyer_type === "consumer" ? "consumer" : config.buyer_type === "export" ? "export" : "business", revision: c.settings?.revision ?? 0 },
    issuerName: issuer.name, issuerIssues, regulatorySources: regulatory.sources, regulatoryChanges: regulatory.changes,
    lastBackupVerification: backup ? { verifiedAt: String(backup.metadata.verified_at), reference: String(backup.metadata.backup_reference), notes: typeof backup.metadata.notes === "string" ? backup.metadata.notes : null } : null };
}

export async function getEinvoiceSupervision(): Promise<EinvoiceSupervisionView> {
  const c = await getEinvoiceContext();
  if (!c.canAdmin) throw new EInvoiceError("FORBIDDEN", "Diagnostic réservé à l’administrateur.", 403);
  if (!c.migrationReady) return { ...base(c), summary: { pending: 0, failed: 0, blocked: 0, integrityFailures: 0 }, jobs: [], events: [], connectorMode: "disabled", lastProcessingAt: null };
  const [docs, jobs, events, entries, validations] = await Promise.all([documents(c), readEinvoiceRows<EinvoiceJobRow>(c.client, "einvoice_jobs", "*", c.workspace.organization.id), history(c),
    readEinvoiceRows<{ id: string; source_document_type: string; source_document_id: string | null; status: string }>(c.client, "accounting_entries", "id,source_document_type,source_document_id,status", c.workspace.organization.id),
    readEinvoiceRows<EinvoiceValidationRow>(c.client, "einvoice_validations", "id,version_id,valid,result,created_at", c.workspace.organization.id)]);
  const byId = new Map(docs.map(doc => [doc.id, doc]));
  const activeEntries = entries.filter(entry => entry.status !== "cancelled");
  const links = docs.map(doc => activeEntries.filter(entry => entry.source_document_id === doc.source_id && entry.source_document_type === (doc.source_kind === "invoice" ? "customer_invoice" : "customer_credit_note")));
  const now = Date.now();
  const validatorAvailable = await xmlRuntimeDiagnostics().then(() => true, () => false);
  const latestValidation = [...validations].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const latestDuration = (latestValidation?.result as unknown as { duration_ms?: number } | undefined)?.duration_ms;
  return { ...base(c), diagnostics: { generated: validations.filter(row => row.valid).length, validated: docs.filter(doc => doc.status !== "draft").length,
    xmlFailures: validations.filter(row => row.result.xsd?.valid === false && !(row.result.xsd as unknown as { notRun?: boolean }).notRun).length,
    duplicateAttempts: events.filter(event => event.event === "operation.failed" && /DUPLICATE|IDEMPOTENCY/.test(String(event.metadata.error_code))).length,
    latestPreparationMs: typeof latestDuration === "number" ? latestDuration : null, validatorAvailable,
    backupAttestedAt: events.filter(event => event.event === "backup.attested").sort((a, b) => b.sequence - a.sequence)[0]?.created_at ?? null,
    sourceChecksFailed: events.filter(event => event.event === "regulatory.observed" && event.metadata.available !== true).length }, summary: { pending: jobs.filter(job => ["queued", "retry_wait", "running"].includes(job.status)).length, failed: jobs.filter(job => job.status === "failed").length,
    blocked: jobs.filter(job => job.status === "running" && job.lease_expires_at && Date.parse(job.lease_expires_at) < now).length,
    integrityFailures: events.filter(event => event.event === "archive.integrity_checked" && event.metadata.ok === false).length,
    linkedAccountingEntries: links.filter(rows => rows.length === 1).length, sourcesWithoutAccounting: links.filter(rows => rows.length === 0).length, duplicateAccountingSources: links.filter(rows => rows.length > 1).length },
    jobs: jobs.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(job => ({ id: job.id, sourceKind: byId.get(job.document_id)?.source_kind ?? "invoice", sourceId: byId.get(job.document_id)?.source_id ?? "", number: byId.get(job.document_id)?.source_number ?? "—", state: job.status, mode: "simulation", attempts: job.attempts, nextAttemptAt: ["queued", "retry_wait"].includes(job.status) ? job.available_at : null, lastError: job.error_code })),
    events: events.sort((a, b) => b.sequence - a.sequence).map(einvoiceEventView), connectorMode: c.settings?.connector_mode ?? "disabled", lastProcessingAt: jobs.filter(job => job.completed_at).sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0]?.completed_at ?? null };
}
