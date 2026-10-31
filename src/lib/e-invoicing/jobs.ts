import { randomUUID } from "node:crypto";
import { createClient as createServiceClient } from "@/lib/supabase/service";
import { EInvoiceError, isEinvoiceRolloutEnabled, uuid } from "./access";
import { createEInvoiceConnector, EInvoiceConnectorError } from "./connector";
import { prepareEInvoice } from "./ubl";
import type { EInvoiceNormalizedSnapshot, EInvoicePreparationOptions, EInvoiceSimulationOutcome } from "./types";
import { ARTIFACT_FIELDS, type EinvoiceArtifactRow, type EinvoiceVersionRow } from "./repository";
import { createEinvoiceAlert } from "./regulatory";
import { verifiedDatabaseArtifactBytes } from "./integrity";

type ClaimedJob = { job_id: string; organization_id: string; document_id: string; version_id: string; transmission_id: string; scenario: "accept" | "reject" | "timeout" | "unavailable"; attempts: number; lease_token: string; lease_expires_at: string };

export function optionsFromSnapshot(snapshot: EInvoiceNormalizedSnapshot): EInvoicePreparationOptions {
  return { buyerType: snapshot.buyerType, lineMetadata: Object.fromEntries(snapshot.lines.map(line => [line.id, { unitCode: line.unitCode, taxCategory: line.taxCategory, exemptionReason: line.exemptionReason }])) };
}

/** One bounded batch; durable leases/backoff/idempotence live in PostgreSQL. */
export async function processEinvoiceJobs(organizationId: string, jobId?: string, limit = 10) {
  const org = uuid(organizationId);
  if (!isEinvoiceRolloutEnabled(org)) throw new EInvoiceError("MODULE_DISABLED", "Le traitement électronique n’est pas activé pour cette entreprise.", 403);
  const service = createServiceClient();
  const worker = `felexia-node-${randomUUID()}`;
  const { data, error } = await service.rpc("einvoice_claim_jobs", { p_worker: worker, p_limit: Math.max(1, Math.min(limit, 10)), p_organization_id: org, p_job_id: jobId ? uuid(jobId) : null });
  if (error) throw new EInvoiceError("JOBS_UNAVAILABLE", "Les traitements en attente n’ont pas pu être repris.", 503);
  const jobs = (data ?? []) as ClaimedJob[];
  const results: { id: string; status: string; simulated: true }[] = [];
  for (const job of jobs) {
    const started = performance.now();
    if (job.organization_id !== org) throw new EInvoiceError("JOB_TENANT_MISMATCH", "Une tâche ne correspond pas à cette entreprise.", 403);
    let outcome: "accepted" | "rejected" | "timeout" | "unavailable" = "unavailable";
    let acknowledgement: Record<string, unknown> = { simulation: true, authority: "FELEXIA_INTERNAL_SIMULATION", official: false };
    let errorCode: string | null = null;
    try {
      const [{ data: rawVersion, error: versionError }, { data: rawArtifacts, error: artifactError }] = await Promise.all([
        service.from("einvoice_versions").select("*").eq("organization_id", org).eq("document_id", job.document_id).eq("id", job.version_id).maybeSingle(),
        service.from("einvoice_artifacts").select(`${ARTIFACT_FIELDS},content`).eq("organization_id", org).eq("document_id", job.document_id).eq("version_id", job.version_id),
      ]);
      if (versionError || artifactError || !rawVersion) throw new Error("ARCHIVE_UNAVAILABLE");
      const version = rawVersion as unknown as EinvoiceVersionRow;
      const snapshot = version.snapshot;
      if (!("schemaVersion" in snapshot) || snapshot.organizationId !== org) throw new Error("ARCHIVE_SNAPSHOT_INVALID");
      const prepared = await prepareEInvoice(snapshot, optionsFromSnapshot(snapshot));
      const artifacts = rawArtifacts as unknown as (EinvoiceArtifactRow & { content: unknown })[];
      const xml = artifacts.find(item => item.format === "xml");
      if (prepared.snapshotSha256 !== version.snapshot_sha256 || !xml || xml.sha256 !== prepared.xmlSha256 || xml.canonical_sha256 !== prepared.canonicalSha256 || !artifacts.some(item => item.format === "pdf")) throw new Error("ARCHIVE_INTEGRITY_FAILED");
      for (const artifact of artifacts) {
        const bytes = verifiedDatabaseArtifactBytes(artifact);
        if (artifact.format === "xml" && !bytes.equals(Buffer.from(prepared.xml, "utf8")) || artifact.format === "pdf" && bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("ARCHIVE_INTEGRITY_FAILED");
      }
      const outcomes: Record<ClaimedJob["scenario"], EInvoiceSimulationOutcome> = { accept: "accepted", reject: "rejected", timeout: "timeout", unavailable: "temporary_failure" };
      const receipt = await createEInvoiceConnector("simulation").submit(prepared, { idempotencyKey: job.transmission_id, outcome: outcomes[job.scenario], attempt: job.attempts });
      outcome = receipt.status === "accepted" ? "accepted" : receipt.status === "rejected" ? "rejected" : "timeout";
      acknowledgement = { ...receipt, official: false };
    } catch (caught) {
      errorCode = caught instanceof EInvoiceConnectorError || caught instanceof EInvoiceError ? caught.code : "ARCHIVE_PROCESSING_FAILED";
      outcome = errorCode === "SIMULATION_TIMEOUT" ? "timeout" : "unavailable";
      acknowledgement = { ...acknowledgement, error_code: errorCode, attempts: job.attempts };
    }
    acknowledgement.processing_duration_ms = Math.round(performance.now() - started);
    const { data: finished, error: finishError } = await service.rpc("einvoice_finish_job", { p_job_id: job.job_id, p_lease_token: job.lease_token, p_outcome: outcome, p_acknowledgement: acknowledgement, p_error_code: errorCode });
    if (finishError || !finished) {
      // Do not pretend completion. The stored lease can expire and be reclaimed.
      console.error("[einvoice] completion not recorded", { jobId: job.job_id, code: finishError?.code });
      throw new EInvoiceError("JOB_COMPLETION_UNAVAILABLE", "La tâche reste conservée en attente de reprise.", 503);
    }
    results.push({ id: job.job_id, status: String(finished.status), simulated: true });
    if (finished.status === "failed") {
      const { data: settings, error: settingsError } = await service.from("einvoice_settings").select("configuration").eq("organization_id", org).maybeSingle();
      if (settingsError) throw new EInvoiceError("ALERT_CONFIGURATION_UNAVAILABLE", "Le résultat est enregistré, mais la configuration des alertes est indisponible.", 503);
      await createEinvoiceAlert(org, `${job.transmission_id}:${finished.status}`, "Traitement électronique à examiner", "Une simulation a été rejetée ou ses reprises ont échoué. Consultez la supervision ; aucune transmission DGI n’a eu lieu.", settings?.configuration?.alerts_enabled !== false);
    }
  }
  // Claim can itself retire an abandoned final lease or a revoked author.
  // These rows never reach finish_job, so publish their alerts on the next pass.
  let alertsPending = false;
  try {
    const [{ data: retired, error: retiredError }, { data: settings, error: settingsError }] = await Promise.all([
      service.from("einvoice_jobs").select("id,transmission_id").eq("organization_id", org).eq("status", "failed").in("error_code", ["LEASE_ATTEMPTS_EXHAUSTED", "ACTOR_AUTHORIZATION_REVOKED"]).order("completed_at", { ascending: false }).limit(10),
      service.from("einvoice_settings").select("configuration").eq("organization_id", org).maybeSingle(),
    ]);
    if (retiredError || settingsError) throw new Error("ALERT_READ_FAILED");
    for (const retiredJob of retired ?? []) await createEinvoiceAlert(org, `${retiredJob.transmission_id}:failed`, "Traitement électronique interrompu", "Une tâche interne a été arrêtée après interruption ou retrait d’autorisation. Un administrateur peut examiner le journal et lancer une nouvelle simulation autorisée.", settings?.configuration?.alerts_enabled !== false);
  } catch { alertsPending = true; console.error("[einvoice] terminal-job alerts pending"); }
  return { processed: results.length, results, alertsPending, simulation: true as const, officialTransmissions: 0 as const };
}
