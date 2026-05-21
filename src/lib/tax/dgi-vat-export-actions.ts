"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { DGI_VAT_SCHEMA_VERSION } from "@/lib/tax/dgi-vat-mapping";
import { generateDgiVatCsv } from "@/lib/tax/dgi-vat-csv";
import { generateDgiVatPreparatoryXml } from "@/lib/tax/dgi-vat-xml";
import { DGI_VAT_XLSX_AVAILABLE, generateDgiVatXlsx } from "@/lib/tax/dgi-vat-xlsx";
import { getDgiVatExportData } from "@/lib/tax/dgi-vat-query";
import { validateDgiVatExport } from "@/lib/tax/dgi-vat-validation";
import type { DgiVatExportData, DgiVatValidationIssue, VatFrequency } from "@/lib/tax/dgi-vat-types";

const TAX_EXPORTS_BUCKET = "tax-exports";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formBool(formData: FormData, key: string) {
  return formData.getAll(key).some((value) => value === "on" || value === "true");
}

function formNumber(formData: FormData, key: string) {
  const value = Number(formText(formData, key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildIdempotencyKey(data: DgiVatExportData) {
  return sha256([
    data.organization.id,
    data.period.startDate,
    data.period.endDate,
    data.period.frequency,
    data.sourceSnapshotHash,
    data.schemaVersion,
  ].join("|"));
}

function exportNumber(periodStart: string, batchId: string) {
  return `DGI-TVA-PREP-${periodStart.slice(0, 7).replace("-", "")}-${batchId.slice(0, 8).toUpperCase()}`;
}

function fileStem(periodStart: string) {
  return `dgi-vat-preparatoire-${periodStart.slice(0, 7)}`;
}

function allowedRole(role: string | null) {
  return ["owner", "admin", "administrateur", "accountant", "comptable"].includes(String(role ?? "").toLowerCase());
}

function withIssues(data: DgiVatExportData, issues: DgiVatValidationIssue[]): DgiVatExportData {
  const blockingErrorsCount = issues.filter((issue) => issue.severity === "blocking").length;
  const warningsCount = issues.filter((issue) => issue.severity === "warning").length;
  return {
    ...data,
    validationIssues: issues,
    summary: {
      ...data.summary,
      blockingErrorsCount,
      warningsCount,
    },
  };
}

function contentTypeFor(file: "xml" | "csv" | "xlsx" | "manifest" | "validation") {
  if (file === "xml") return "application/xml; charset=utf-8";
  if (file === "csv") return "text/csv; charset=utf-8";
  if (file === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/json; charset=utf-8";
}

async function uploadTextFile(path: string, content: string, contentType: string) {
  const supabase = await createClient();
  return supabase.storage
    .from(TAX_EXPORTS_BUCKET)
    .upload(path, Buffer.from(content, "utf8"), {
      contentType,
      cacheControl: "60",
      upsert: false,
    });
}

async function insertAuditLog(action: string, batchId: string, changes: Record<string, unknown>) {
  try {
    const workspace = await requireActiveWorkspace();
    const supabase = await createClient();
    await supabase.from("audit_logs").insert({
      organization_id: workspace.organization.id,
      actor_id: workspace.userId,
      table_name: "tax_export_batches",
      record_id: batchId,
      action,
      changes,
    });
  } catch {
    // Audit logs are best effort because older environments may not have the table yet.
  }
}

export async function generateDgiVatXmlAction(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();

  if (!allowedRole(workspace.role)) {
    redirect("/comptabilite/tva/exports?generation=unauthorized");
  }

  const periodStart = formText(formData, "periodStart") ?? formText(formData, "period_start");
  const periodEnd = formText(formData, "periodEnd") ?? formText(formData, "period_end");
  const frequency = (formText(formData, "frequency") === "quarterly" ? "quarterly" : "monthly") as VatFrequency;
  const priorCreditMad = formNumber(formData, "priorCreditMad");
  const previewOnly = formBool(formData, "previewOnly");
  const includeXml = formBool(formData, "includeXml");
  const includeCsv = formBool(formData, "includeCsv");
  const includeXlsx = formBool(formData, "includeXlsx");
  const forceRegenerate = formBool(formData, "forceRegenerate");

  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    redirect("/comptabilite/tva/exports?generation=period-error");
  }
  if (!includeXml && !includeCsv && !includeXlsx) {
    redirect("/comptabilite/tva/exports?generation=format-error");
  }

  const rawData = await getDgiVatExportData({
    organizationId: workspace.organization.id,
    periodStart,
    periodEnd,
    frequency,
    generatedBy: workspace.userId,
    priorCreditMad,
  });

  const data = withIssues(rawData, validateDgiVatExport(rawData));
  const blockingIssues = data.validationIssues.filter((issue) => issue.severity === "blocking");
  const warningIssues = data.validationIssues.filter((issue) => issue.severity === "warning");
  const idempotencyKey = buildIdempotencyKey(data);

  if (previewOnly) {
    await insertAuditLog("dgi_vat_preflight", data.batchId, {
      periodStart,
      periodEnd,
      frequency,
      blocking: blockingIssues.length,
      warnings: warningIssues.length,
    });
    revalidatePath("/comptabilite/tva/exports");
    redirect(`/comptabilite/tva/exports?from=${periodStart}&to=${periodEnd}&frequency=${frequency}&preflight=1`);
  }

  const { data: existingBatch } = await supabase
    .from("tax_export_batches")
    .select("id, status")
    .eq("organization_id", workspace.organization.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingBatch?.id && !forceRegenerate) {
    redirect(`/comptabilite/tva/exports?generation=existing&batch=${existingBatch.id}`);
  }

  if (existingBatch?.id && forceRegenerate) {
    await supabase
      .from("tax_export_batches")
      .update({ status: "superseded" })
      .eq("organization_id", workspace.organization.id)
      .eq("id", existingBatch.id);
  }

  const batchId = data.batchId;
  const year = periodStart.slice(0, 4);
  const stem = fileStem(periodStart);
  const basePath = `organizations/${workspace.organization.id}/tva/${year}/${batchId}`;
  const validationReport = JSON.stringify({
    schemaVersion: data.schemaVersion,
    schemaStatus: "preparatory",
    officialConformityClaim: false,
    generatedAt: data.generatedAt,
    issues: data.validationIssues,
  }, null, 2);

  if (blockingIssues.length > 0) {
    const exportNo = exportNumber(periodStart, batchId);
    const validationPath = `${basePath}/validation-report.json`;
    await uploadTextFile(validationPath, validationReport, contentTypeFor("validation"));

    await supabase.from("tax_export_batches").insert({
      id: batchId,
      organization_id: workspace.organization.id,
      export_number: exportNo,
      export_type: "dgi_vat_xml_prep",
      period_start: periodStart,
      period_end: periodEnd,
      frequency,
      regime: data.period.regime,
      format: "xml",
      status: "preflight_failed",
      idempotency_key: idempotencyKey,
      schema_version: DGI_VAT_SCHEMA_VERSION,
      source_snapshot_hash: data.sourceSnapshotHash,
      file_bucket: TAX_EXPORTS_BUCKET,
      validation_report_path: validationPath,
      generated_by: workspace.userId,
      preflight_summary: {
        blocking: blockingIssues.length,
        warnings: warningIssues.length,
      },
      totals: data.summary,
      warnings: warningIssues,
      validation_errors: blockingIssues,
      notes: "Export XML préparatoire non généré : anomalies bloquantes détectées.",
    });

    await insertAuditLog("dgi_vat_preflight_failed", batchId, {
      periodStart,
      periodEnd,
      frequency,
      blocking: blockingIssues.length,
      warnings: warningIssues.length,
    });
    revalidatePath("/comptabilite/tva/exports");
    redirect(`/comptabilite/tva/exports?generation=preflight-failed&batch=${batchId}`);
  }

  const exportNo = exportNumber(periodStart, batchId);
  const xmlPath = includeXml ? `${basePath}/${stem}.xml` : null;
  const csvPath = includeCsv ? `${basePath}/${stem}.csv` : null;
  const xlsxPath = includeXlsx && DGI_VAT_XLSX_AVAILABLE ? `${basePath}/${stem}.xlsx` : null;
  const manifestPath = `${basePath}/manifest.json`;
  const validationPath = `${basePath}/validation-report.json`;

  const manifest = {
    schemaVersion: data.schemaVersion,
    schemaStatus: "preparatory",
    officialConformityClaim: false,
    organizationId: data.organization.id,
    periodStart,
    periodEnd,
    frequency,
    generatedAt: data.generatedAt,
    generatedBy: workspace.userId,
    sourceSnapshotHash: data.sourceSnapshotHash,
    summary: data.summary,
    files: {
      xml: xmlPath,
      csv: csvPath,
      xlsx: xlsxPath,
    },
    warningsCount: warningIssues.length,
    blockingErrorsCount: blockingIssues.length,
  };

  if (xmlPath) {
    const upload = await uploadTextFile(xmlPath, generateDgiVatPreparatoryXml(data), contentTypeFor("xml"));
    if (upload.error) redirect("/comptabilite/tva/exports?generation=storage-error");
  }
  if (csvPath) {
    const upload = await uploadTextFile(csvPath, generateDgiVatCsv(data), contentTypeFor("csv"));
    if (upload.error) redirect("/comptabilite/tva/exports?generation=storage-error");
  }
  if (xlsxPath) {
    const xlsx = await generateDgiVatXlsx(data);
    if (xlsx) {
      const upload = await supabase.storage.from(TAX_EXPORTS_BUCKET).upload(xlsxPath, Buffer.from(xlsx), {
        contentType: contentTypeFor("xlsx"),
        cacheControl: "60",
        upsert: false,
      });
      if (upload.error) redirect("/comptabilite/tva/exports?generation=storage-error");
    }
  }
  await uploadTextFile(manifestPath, JSON.stringify(manifest, null, 2), contentTypeFor("manifest"));
  await uploadTextFile(validationPath, validationReport, contentTypeFor("validation"));

  const status = warningIssues.length > 0 ? "generated_with_warnings" : "generated";
  const { error: insertError } = await supabase.from("tax_export_batches").insert({
    id: batchId,
    organization_id: workspace.organization.id,
    export_number: exportNo,
    export_type: "dgi_vat_xml_prep",
    period_start: periodStart,
    period_end: periodEnd,
    frequency,
    regime: data.period.regime,
    format: "xml",
    status,
    idempotency_key: idempotencyKey,
    schema_version: DGI_VAT_SCHEMA_VERSION,
    source_snapshot_hash: data.sourceSnapshotHash,
    file_bucket: TAX_EXPORTS_BUCKET,
    file_name: xmlPath ? `${stem}.xml` : `${stem}.csv`,
    file_path: xmlPath ?? csvPath,
    xml_path: xmlPath,
    csv_path: csvPath,
    xlsx_path: xlsxPath,
    manifest_path: manifestPath,
    validation_report_path: validationPath,
    generated_by: workspace.userId,
    preflight_summary: {
      blocking: blockingIssues.length,
      warnings: warningIssues.length,
    },
    totals: data.summary,
    warnings: warningIssues,
    validation_errors: blockingIssues,
    notes: "Dossier préparatoire TVA DGI généré. Ce fichier ne constitue pas une homologation officielle DGI.",
  });

  if (insertError) {
    redirect("/comptabilite/tva/exports?generation=error");
  }

  await insertAuditLog("dgi_vat_xml_generated", batchId, {
    periodStart,
    periodEnd,
    frequency,
    status,
    xmlPath,
    csvPath,
    xlsxPath,
  });

  revalidatePath("/comptabilite/tva/exports");
  redirect(`/comptabilite/tva/exports?generation=success&batch=${batchId}`);
}
