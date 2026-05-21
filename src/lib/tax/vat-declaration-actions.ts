"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { getDgiVatExportData } from "@/lib/tax/dgi-vat-query";
import { validateDgiVatExport } from "@/lib/tax/dgi-vat-validation";
import { roundMad } from "@/lib/tax/dgi-vat-mapping";
import { runVatAutoFixes } from "@/lib/tax/vat-anomaly-autofix";
import type { DgiVatValidationIssue } from "@/lib/tax/dgi-vat-types";
import type { VatDeclarationActionResult, VatDeclarationFrequency, VatDeclarationRegime } from "@/lib/tax/vat-declaration-types";

function formText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formNumber(formData: FormData, key: string): number {
  const value = Number(formText(formData, key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function allowedRole(role: string | null) {
  return ["owner", "admin", "administrateur", "accountant", "comptable"].includes(String(role ?? "").toLowerCase());
}

function generateDeclarationNumber(periodStart: string, frequency: string, sequence: number): string {
  const base = periodStart.slice(0, 7).replace("-", "");
  const freqSuffix = frequency === "quarterly" ? "-T" : frequency === "annual_control" ? "-A" : "";
  return `TVA-${base}${freqSuffix}-${String(sequence).padStart(4, "0")}`;
}

export async function createVatDeclarationAction(_prev: VatDeclarationActionResult, formData: FormData): Promise<VatDeclarationActionResult> {
  const workspace = await requireActiveWorkspace();
  if (!allowedRole(workspace.role)) {
    return { success: false, error: "Vous n'avez pas les droits pour créer une déclaration TVA." };
  }

  const orgId = workspace.organization.id;
  const periodStart = formText(formData, "periodStart");
  const periodEnd = formText(formData, "periodEnd");
  const frequency = (formText(formData, "frequency") ?? "monthly") as VatDeclarationFrequency;
  const vatRegime = (formText(formData, "vatRegime") ?? "unspecified") as VatDeclarationRegime;
  const priorCredit = formNumber(formData, "priorCredit");
  const notes = formText(formData, "notes");

  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    return { success: false, error: "La période est invalide." };
  }

  const supabase = await createClient();

  // Check for existing non-archived declaration for same period
  const { data: existing } = await supabase
    .from("vat_declarations")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .eq("frequency", frequency)
    .is("archived_at", null)
    .maybeSingle();

  if (existing && existing.status !== "archived") {
    return { success: false, error: "Une déclaration non archivée existe déjà pour cette période et cette fréquence." };
  }

  // Compute VAT data
  const exportData = await getDgiVatExportData({
    organizationId: orgId,
    periodStart,
    periodEnd,
    frequency: frequency === "annual_control" ? "quarterly" : frequency,
    generatedBy: workspace.userId,
    priorCreditMad: priorCredit,
  });

  const validationIssues = validateDgiVatExport(exportData);
  const blockingErrorsCount = validationIssues.filter((i) => i.severity === "blocking").length;
  const warningsCount = validationIssues.filter((i) => i.severity === "warning").length;

  // Build totals by rate
  const salesBreakdowns = exportData.salesDocuments.flatMap((d) => d.taxBreakdown);
  const purchaseBreakdowns = exportData.purchaseDocuments.flatMap((d) => d.taxBreakdown.map((b) => ({ taxRate: b.taxRate, vatAmountMad: b.deductibleVatMad })));

  const collectedByRate = new Map<number, number>();
  for (const b of salesBreakdowns) {
    collectedByRate.set(b.taxRate, roundMad((collectedByRate.get(b.taxRate) ?? 0) + b.vatAmountMad));
  }
  const deductibleByRate = new Map<number, number>();
  for (const b of purchaseBreakdowns) {
    deductibleByRate.set(b.taxRate, roundMad((deductibleByRate.get(b.taxRate) ?? 0) + b.vatAmountMad));
  }

  const totalsByRate: Record<string, { collected: number; deductible: number }> = {};
  for (const [rate, collected] of collectedByRate) {
    totalsByRate[String(rate)] = { collected, deductible: deductibleByRate.get(rate) ?? 0 };
  }
  for (const [rate, deductible] of deductibleByRate) {
    if (!totalsByRate[String(rate)]) {
      totalsByRate[String(rate)] = { collected: 0, deductible };
    }
  }

  // Generate unique declaration number
  const { count } = await supabase
    .from("vat_declarations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", `${periodStart.slice(0, 4)}-01-01`);

  const declarationNumber = generateDeclarationNumber(periodStart, frequency, (count ?? 0) + 1);

  const insertPayload = {
    organization_id: orgId,
    declaration_number: declarationNumber,
    period_start: periodStart,
    period_end: periodEnd,
    frequency,
    vat_regime: vatRegime,
    status: blockingErrorsCount > 0 ? "under_review" : "draft",
    prior_credit: roundMad(priorCredit),
    collected_vat: roundMad(exportData.summary.collectedVatMad),
    deductible_vat: roundMad(exportData.summary.deductibleVatMad),
    vat_due: roundMad(exportData.summary.vatDueMad),
    credit_to_carry_forward: roundMad(exportData.summary.creditCarryForwardMad),
    taxable_turnover: roundMad(exportData.summary.taxableTurnoverMad),
    total_sales_ttc: roundMad(salesBreakdowns.reduce((s, b) => s + (b.totalTtcMad ?? 0), 0)),
    total_purchases_ht: roundMad(exportData.summary.totalTurnoverMad),
    total_purchases_ttc: roundMad(exportData.purchaseDocuments.reduce((s, d) => s + d.totalTtcMad, 0)),
    customer_invoices_count: exportData.summary.salesCount,
    supplier_invoices_count: exportData.summary.purchaseCount,
    blocking_errors_count: blockingErrorsCount,
    warnings_count: warningsCount,
    validation_summary: {
      issues: validationIssues,
      preflightOnly: true,
      preparatoryNote: "Déclaration préparatoire Felexia — non homologuée DGI.",
    },
    totals_by_rate: totalsByRate,
    notes: notes,
    created_by: workspace.userId,
  };

  const { data: inserted, error } = await supabase
    .from("vat_declarations")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    const msg = error.message ?? "";
    const isRlsError = msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row-level security");
    if (isRlsError) {
      console.error("[vat-declaration-actions] RLS insert blocked:", {
        userId: workspace.userId,
        orgId,
        role: workspace.role,
        error: msg,
        code: error.code,
      });
      return { success: false, error: "Vous n'êtes pas autorisé à créer une déclaration TVA pour cette organisation. Vérifiez votre rôle (owner, admin ou comptable requis)." };
    }
    return { success: false, error: msg };
  }

  revalidatePath("/comptabilite/tva/declarations");
  redirect(`/comptabilite/tva/declarations/${inserted.id}`);
}

export async function validateVatDeclarationAction(prev: VatDeclarationActionResult, formData: FormData): Promise<VatDeclarationActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  if (!allowedRole(workspace.role)) {
    return { success: false, error: "Permissions insuffisantes." };
  }

  const id = formText(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const supabase = await createClient();
  const { data: declaration } = await supabase
    .from("vat_declarations")
    .select("id, status, blocking_errors_count")
    .eq("id", id)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();

  if (!declaration) return { success: false, error: "Déclaration introuvable." };
  if (declaration.status !== "draft" && declaration.status !== "under_review") {
    return { success: false, error: "Seules les déclarations en brouillon ou en révision peuvent être validées." };
  }
  if (declaration.blocking_errors_count > 0) {
    return { success: false, error: "Corrigez les anomalies bloquantes avant de valider la déclaration TVA." };
  }

  const { error } = await supabase
    .from("vat_declarations")
    .update({
      status: "validated",
      validated_by: workspace.userId,
      validated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", workspace.organization.id);

  if (error) {
    const msg = error.message ?? "";
    const isRlsError = msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row-level security");
    if (isRlsError) {
      console.error("[vat-declaration-actions] RLS update blocked (validate):", { userId: workspace.userId, orgId: workspace.organization.id, role: workspace.role, error: msg, code: error.code });
      return { success: false, error: "Vous n'êtes pas autorisé à valider cette déclaration TVA." };
    }
    return { success: false, error: msg };
  }
  revalidatePath("/comptabilite/tva/declarations");
  revalidatePath(`/comptabilite/tva/declarations/${id}`);
  return { success: true };
}

export async function archiveVatDeclarationAction(prev: VatDeclarationActionResult, formData: FormData): Promise<VatDeclarationActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  if (!allowedRole(workspace.role)) {
    return { success: false, error: "Permissions insuffisantes." };
  }

  const id = formText(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const supabase = await createClient();
  const { data: declaration } = await supabase
    .from("vat_declarations")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();

  if (!declaration) return { success: false, error: "Déclaration introuvable." };
  if (declaration.status !== "draft" && declaration.status !== "under_review") {
    return { success: false, error: "Seules les déclarations en brouillon peuvent être archivées." };
  }

  const { error } = await supabase
    .from("vat_declarations")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", workspace.organization.id);

  if (error) {
    const msg = error.message ?? "";
    const isRlsError = msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("violates row-level security");
    if (isRlsError) {
      console.error("[vat-declaration-actions] RLS update blocked (archive):", { userId: workspace.userId, orgId: workspace.organization.id, role: workspace.role, error: msg, code: error.code });
      return { success: false, error: "Vous n'êtes pas autorisé à archiver cette déclaration TVA." };
    }
    return { success: false, error: msg };
  }
  revalidatePath("/comptabilite/tva/declarations");
  return { success: true };
}

export async function autoFixVatDeclarationAnomaliesAction(prev: VatDeclarationActionResult, formData: FormData): Promise<VatDeclarationActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  if (!allowedRole(workspace.role)) {
    return { success: false, error: "Vous n'avez pas les droits pour corriger les anomalies TVA." };
  }

  const id = formText(formData, "id");
  if (!id) return { success: false, error: "ID manquant." };

  const supabase = await createClient();

  // Load declaration
  const { data: declaration } = await supabase
    .from("vat_declarations")
    .select("*")
    .eq("id", id)
    .eq("organization_id", workspace.organization.id)
    .maybeSingle();

  if (!declaration) return { success: false, error: "Déclaration introuvable." };

  const validationIssues = (declaration.validation_summary?.issues ?? []) as Array<{
    severity: string;
    code: string;
    message: string;
    source?: string;
    sourceId?: string | null;
    correctionUrl?: string | null;
    correctionLabel?: string | null;
  }>;

  const blockingIssues = validationIssues.filter((i) => i.severity === "blocking");

  if (blockingIssues.length === 0) {
    return { success: true, error: "Aucune anomalie bloquante à corriger." };
  }

  // Run auto-fixes
  const { results: fixResults, fixedCount, skippedCount } = await runVatAutoFixes(
    supabase,
    workspace.organization.id,
    blockingIssues as DgiVatValidationIssue[],
  );

  // Recalculate declaration
  const exportData = await getDgiVatExportData({
    organizationId: workspace.organization.id,
    periodStart: declaration.period_start,
    periodEnd: declaration.period_end,
    frequency: declaration.frequency === "annual_control" ? "quarterly" : declaration.frequency,
    generatedBy: workspace.userId,
    priorCreditMad: Number(declaration.prior_credit),
  });

  const newValidationIssues = validateDgiVatExport(exportData);
  const newBlockingCount = newValidationIssues.filter((i) => i.severity === "blocking").length;
  const newWarningsCount = newValidationIssues.filter((i) => i.severity === "warning").length;

  // Build totals by rate
  const salesBreakdowns = exportData.salesDocuments.flatMap((d) => d.taxBreakdown);
  const purchaseBreakdowns = exportData.purchaseDocuments.flatMap((d) => d.taxBreakdown.map((b) => ({ taxRate: b.taxRate, vatAmountMad: b.deductibleVatMad })));

  const collectedByRate = new Map<number, number>();
  for (const b of salesBreakdowns) {
    collectedByRate.set(b.taxRate, roundMad((collectedByRate.get(b.taxRate) ?? 0) + b.vatAmountMad));
  }
  const deductibleByRate = new Map<number, number>();
  for (const b of purchaseBreakdowns) {
    deductibleByRate.set(b.taxRate, roundMad((deductibleByRate.get(b.taxRate) ?? 0) + b.vatAmountMad));
  }

  const totalsByRate: Record<string, { collected: number; deductible: number }> = {};
  for (const [rate, collected] of collectedByRate) {
    totalsByRate[String(rate)] = { collected, deductible: deductibleByRate.get(rate) ?? 0 };
  }
  for (const [rate, deductible] of deductibleByRate) {
    if (!totalsByRate[String(rate)]) {
      totalsByRate[String(rate)] = { collected: 0, deductible };
    }
  }

  const autoFixHistory = (declaration.validation_summary?.auto_fix_history ?? []) as Array<Record<string, unknown>>;
  autoFixHistory.push({
    at: new Date().toISOString(),
    by: workspace.userId,
    fixedCount,
    skippedCount,
    remainingBlockingCount: newBlockingCount,
    fixedIssues: fixResults.filter((r) => r.fixed).map((r) => ({ code: r.code, table: r.affectedTable, id: r.affectedId })),
  });

  const { error: updateError } = await supabase
    .from("vat_declarations")
    .update({
      status: newBlockingCount > 0 ? "under_review" : "draft",
      collected_vat: roundMad(exportData.summary.collectedVatMad),
      deductible_vat: roundMad(exportData.summary.deductibleVatMad),
      vat_due: roundMad(exportData.summary.vatDueMad),
      credit_to_carry_forward: roundMad(exportData.summary.creditCarryForwardMad),
      taxable_turnover: roundMad(exportData.summary.taxableTurnoverMad),
      total_sales_ttc: roundMad(salesBreakdowns.reduce((s, b) => s + (b.totalTtcMad ?? 0), 0)),
      total_purchases_ht: roundMad(exportData.summary.totalTurnoverMad),
      total_purchases_ttc: roundMad(exportData.purchaseDocuments.reduce((s, d) => s + d.totalTtcMad, 0)),
      customer_invoices_count: exportData.summary.salesCount,
      supplier_invoices_count: exportData.summary.purchaseCount,
      blocking_errors_count: newBlockingCount,
      warnings_count: newWarningsCount,
      validation_summary: {
        issues: newValidationIssues,
        preflightOnly: true,
        preparatoryNote: "Déclaration préparatoire Felexia — non homologuée DGI.",
        auto_fix_history: autoFixHistory,
      },
      totals_by_rate: totalsByRate,
    })
    .eq("id", id)
    .eq("organization_id", workspace.organization.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath("/comptabilite/tva/declarations");
  revalidatePath(`/comptabilite/tva/declarations/${id}`);

  return {
    success: true,
    error: `${fixedCount} anomalie(s) corrigée(s), ${skippedCount} ignorée(s). ${newBlockingCount} anomalie(s) bloquante(s) restante(s).`,
  };
}
