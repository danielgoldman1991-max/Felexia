"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import {
  buildDgiVatPreparationCsv,
  getDgiVatPreparationData,
  TAX_EXPORTS_BUCKET,
  type VatExportFilters,
} from "@/lib/tva";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function exportStatusLabel(status: string) {
  if (status === "blocked") return "Bloqué";
  if (status === "generated_with_warnings") return "Généré avec alertes";
  if (status === "ready") return "Prêt pour déclaration";
  return "Brouillon";
}

export async function generateDgiVatPreparationAction(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const periodStart = text(formData, "period_start");
  const periodEnd = text(formData, "period_end");
  const regime = text(formData, "regime") ?? "monthly";
  const format = text(formData, "format") ?? "csv";
  const includeCustomers = checkbox(formData, "include_customer_invoices");
  const includeSuppliers = checkbox(formData, "include_supplier_invoices");
  const includeAccounting = checkbox(formData, "include_accounting_entries");

  let source: VatExportFilters["source"] = "all";
  if (includeCustomers && !includeSuppliers && !includeAccounting) source = "customer_invoices";
  if (!includeCustomers && includeSuppliers && !includeAccounting) source = "supplier_invoices";
  if (!includeCustomers && !includeSuppliers && includeAccounting) source = "accounting_entries";

  const data = await getDgiVatPreparationData({
    from: periodStart,
    to: periodEnd,
    regime,
    source,
    type: "dgi",
    format,
  });

  const csv = buildDgiVatPreparationCsv(data);
  const exportYear = (periodStart ?? new Date().toISOString()).slice(0, 4);
  const filePeriod = periodStart ? periodStart.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const now = new Date();
  const exportNumber = `DGI-TVA-${filePeriod.replace("-", "")}-${String(now.getTime()).slice(-6)}`;
  const fileName = `export-tva-dgi-preparatoire-${filePeriod}.csv`;

  const { data: batch, error: batchError } = await supabase
    .from("tax_export_batches")
    .insert({
      organization_id: workspace.organization.id,
      export_number: exportNumber,
      export_type: "dgi_vat_preparation",
      period_start: data.period.start,
      period_end: data.period.end,
      regime,
      format: "csv",
      status: data.summary.status,
      file_name: fileName,
      generated_by: workspace.userId,
      controls_summary: {
        blocking: data.summary.blockingIssuesCount,
        warnings: data.summary.warningIssuesCount,
        controls: data.controls.map((control) => ({
          key: control.key,
          severity: control.severity,
          count: control.count,
          message: control.message,
        })),
      },
      totals: {
        collectedVat: data.summary.collectedVat,
        deductibleVat: data.summary.deductibleVat,
        estimatedBalance: data.summary.estimatedBalance,
        salesBaseHt: data.summary.salesBaseHt,
        purchasesBaseHt: data.summary.purchasesBaseHt,
        customerInvoicesCount: data.summary.customerInvoicesCount,
        supplierInvoicesCount: data.summary.supplierInvoicesCount,
      },
      notes: data.summary.status === "blocked"
        ? "Export préparatoire bloqué : anomalies bloquantes détectées. Rapport de contrôle généré."
        : `Dossier préparatoire DGI TVA généré. Statut : ${exportStatusLabel(data.summary.status)}.`,
    })
    .select("id")
    .single();

  if (batchError || !batch?.id) {
    redirect("/comptabilite/tva/exports?generation=error");
  }

  const filePath = `organizations/${workspace.organization.id}/tva/${exportYear}/${batch.id}/${fileName}`;
  const { error: uploadError } = await supabase.storage
    .from(TAX_EXPORTS_BUCKET)
    .upload(filePath, new Blob([csv], { type: "text/csv;charset=utf-8" }), {
      contentType: "text/csv;charset=utf-8",
      cacheControl: "60",
      upsert: false,
    });

  if (uploadError) {
    await supabase
      .from("tax_export_batches")
      .update({
        status: "failed",
        notes: `Échec du stockage du dossier préparatoire DGI TVA : ${uploadError.message}`,
      })
      .eq("organization_id", workspace.organization.id)
      .eq("id", batch.id);
    redirect("/comptabilite/tva/exports?generation=storage-error");
  }

  await supabase
    .from("tax_export_batches")
    .update({ file_path: filePath })
    .eq("organization_id", workspace.organization.id)
    .eq("id", batch.id);

  revalidatePath("/comptabilite/tva/exports");
  redirect(`/comptabilite/tva/exports/${batch.id}/download`);
}
