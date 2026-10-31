import { createHash } from "node:crypto";
import { prepareEInvoice } from "./ubl";
import { validateEInvoiceSnapshot } from "./validation";
import type { EInvoiceConnectorMode, EInvoiceConnectorReceipt, EInvoicePreparationOptions, EInvoicePreparedArtifact, EInvoiceSimulationOutcome, EInvoiceSnapshotInput } from "./types";

export class EInvoiceConnectorError extends Error {
  constructor(readonly code: string, readonly retryable = false) { super(code); this.name = "EInvoiceConnectorError"; }
}

export type EInvoiceSimulationRequest = { idempotencyKey: string; outcome?: EInvoiceSimulationOutcome; attempt?: number };

/** This adapter never opens a connection or accepts credentials/private keys. */
export function createEInvoiceConnector(mode: EInvoiceConnectorMode = "disabled") {
  const operations = new Map<string, { key: string; receipt: EInvoiceConnectorReceipt }>();
  function requireSimulation() {
    if (mode === "official") throw new EInvoiceConnectorError("DGI_OFFICIAL_SPECIFICATIONS_UNAVAILABLE");
    if (mode !== "simulation") throw new EInvoiceConnectorError("CONNECTOR_DISABLED");
  }
  function reconcile(receipt: EInvoiceConnectorReceipt) {
    requireSimulation();
    if (!receipt || receipt.simulation !== true || receipt.authority !== "FELEXIA_INTERNAL_SIMULATION" || !/^SIMULATED-[a-f0-9]{32}$/.test(receipt.reference) || !/^[a-f0-9]{64}$/.test(receipt.documentHash) || !["accepted", "rejected", "pending", "unknown"].includes(receipt.status) || !receipt.acknowledgement.startsWith("SIMULATED — ")) throw new EInvoiceConnectorError("SIMULATION_RECEIPT_INVALID");
    return { ...receipt };
  }
  function getStatus(reference: string | EInvoiceConnectorReceipt) {
    requireSimulation();
    if (typeof reference !== "string") return reconcile(reference);
    const found = operations.get(reference);
    if (!found) throw new EInvoiceConnectorError("SIMULATION_RECORD_NOT_FOUND");
    return { ...found.receipt };
  }
  return {
    mode,
    capabilities: { localValidation: true, localPreparation: true, simulation: mode === "simulation", officialConnection: false, signature: false, networkRequests: 0 } as const,
    validate: (input: EInvoiceSnapshotInput, options: EInvoicePreparationOptions) => validateEInvoiceSnapshot(input, options),
    prepare: (input: EInvoiceSnapshotInput, options: EInvoicePreparationOptions) => prepareEInvoice(input, options),
    async sign(): Promise<never> { throw new EInvoiceConnectorError("SIGNATURE_PROVIDER_NOT_CONFIGURED"); },
    async submit(artifact: EInvoicePreparedArtifact, request: EInvoiceSimulationRequest): Promise<EInvoiceConnectorReceipt> {
      requireSimulation();
      if (!request?.idempotencyKey || request.idempotencyKey.length > 200 || !artifact?.validation.valid || !/^[a-f0-9]{64}$/.test(artifact.canonicalSha256)) throw new EInvoiceConnectorError("SIMULATION_REQUEST_INVALID");
      const reference = "SIMULATED-" + createHash("sha256").update(artifact.snapshot.organizationId + "|" + request.idempotencyKey).digest("hex").slice(0, 32);
      const prior = operations.get(reference);
      if (prior && prior.receipt.documentHash !== artifact.canonicalSha256) throw new EInvoiceConnectorError("IDEMPOTENCY_DOCUMENT_MISMATCH");
      if (prior && ["accepted", "rejected"].includes(prior.receipt.status)) return { ...prior.receipt };
      const attempt = request.attempt ?? (prior?.receipt.attempts ?? 0) + 1;
      if (!Number.isSafeInteger(attempt) || attempt < 1) throw new EInvoiceConnectorError("SIMULATION_ATTEMPT_INVALID");
      const outcome = request.outcome ?? "accepted";
      if (!["accepted", "rejected", "timeout", "temporary_failure", "unknown"].includes(outcome)) throw new EInvoiceConnectorError("SIMULATION_OUTCOME_INVALID");
      const status = outcome === "accepted" || outcome === "temporary_failure" && attempt > 1 ? "accepted" : outcome === "rejected" ? "rejected" : outcome === "unknown" ? "unknown" : "pending";
      const receipt: EInvoiceConnectorReceipt = { simulation: true, authority: "FELEXIA_INTERNAL_SIMULATION", reference, status, documentHash: artifact.canonicalSha256, acknowledgement: "SIMULATED — résultat interne Felexia, sans transmission ni accusé DGI.", attempts: attempt };
      operations.set(reference, { key: request.idempotencyKey, receipt });
      if (outcome === "timeout") throw new EInvoiceConnectorError("SIMULATION_TIMEOUT", true);
      if (outcome === "temporary_failure" && attempt === 1) throw new EInvoiceConnectorError("SIMULATION_TEMPORARY_FAILURE", true);
      return { ...receipt };
    },
    getStatus,
    getAcknowledgement: (reference: string | EInvoiceConnectorReceipt) => getStatus(reference),
    reconcile,
  };
}
