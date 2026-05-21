import type { DgiVatValidationIssue } from "@/lib/tax/dgi-vat-types";

export type VatAnomalyFixability = "auto_fixable" | "manual_required" | "dangerous_do_not_fix";

export type VatAnomalyClassification = {
  fixability: VatAnomalyFixability;
  reason: string;
  actionLabel: string;
};

export type AutoFixResult = {
  code: string;
  fixed: boolean;
  message: string;
  affectedTable?: string;
  affectedId?: string;
};

const AUTO_FIXABLE_CODES = new Set([
  "VAT_TOTAL_MISMATCH",
  "PAYMENT_STATUS_MISMATCH",
  "MISSING_TAX_RATE_ID",
  "MISSING_UNIT_ID",
  "DECLARATION_TOTALS_STALE",
]);

const DANGEROUS_CODES = new Set([
  "FX_RATE_MISSING",
  "NO_DATA_FOR_PERIOD",
  "PERIOD_INVALID",
]);

export function classifyVatAnomaly(issue: DgiVatValidationIssue): VatAnomalyClassification {
  if (AUTO_FIXABLE_CODES.has(issue.code)) {
    return { fixability: "auto_fixable", reason: "Anomalie technique corrigeable par recalcul.", actionLabel: "Corriger automatiquement" };
  }
  if (DANGEROUS_CODES.has(issue.code)) {
    return { fixability: "dangerous_do_not_fix", reason: "Nécessite une intervention métier ou une saisie de donnée réelle.", actionLabel: "Ne pas corriger automatiquement" };
  }
  return { fixability: "manual_required", reason: "Nécessite une saisie manuelle de donnée fiscale ou métier.", actionLabel: "Corriger manuellement" };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fixInvoiceLineTotals(supabase: any, orgId: string, invoiceId: string, table: "customer_invoice_lines" | "supplier_invoice_lines", invoiceTable: "customer_invoices" | "supplier_invoices"): Promise<AutoFixResult> {
  const { data: lines } = await supabase
    .from(table)
    .select("id, quantity, unit_price_ht, discount_rate, tax_rate")
    .eq("invoice_id", invoiceId)
    .eq("organization_id", orgId);

  if (!lines || lines.length === 0) {
    return { code: "VAT_TOTAL_MISMATCH", fixed: false, message: "Aucune ligne trouvée pour recalcul.", affectedTable: table, affectedId: invoiceId };
  }

  let hasFix = false;
  for (const line of lines as Array<{ id: string; quantity: number; unit_price_ht: number; discount_rate: number; tax_rate: number }>) {
    const qty = Number(line.quantity ?? 0);
    const price = Number(line.unit_price_ht ?? 0);
    const discRate = Number(line.discount_rate ?? 0);
    const taxRate = Number(line.tax_rate ?? 0);
    if (qty <= 0 || price < 0 || !Number.isFinite(taxRate)) continue;

    const baseHt = round2(qty * price);
    const discountAmount = round2(baseHt * (discRate / 100));
    const netHt = round2(baseHt - discountAmount);
    const taxAmount = round2(netHt * (taxRate / 100));
    const totalTtc = round2(netHt + taxAmount);

    const { error } = await supabase
      .from(table)
      .update({
        subtotal_ht: baseHt,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_ttc: totalTtc,
      })
      .eq("id", line.id)
      .eq("organization_id", orgId);

    if (!error) hasFix = true;
  }

  const { data: updatedLines } = await supabase
    .from(table)
    .select("subtotal_ht, discount_amount, tax_amount, total_ttc")
    .eq("invoice_id", invoiceId)
    .eq("organization_id", orgId);

  const subtotalHt = (updatedLines ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.subtotal_ht ?? 0), 0);
  const discountTotal = (updatedLines ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.discount_amount ?? 0), 0);
  const taxTotal = (updatedLines ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.tax_amount ?? 0), 0);
  const totalTtc = (updatedLines ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r.total_ttc ?? 0), 0);

  await supabase
    .from(invoiceTable)
    .update({
      subtotal_ht: round2(subtotalHt),
      discount_total: round2(discountTotal),
      tax_total: round2(taxTotal),
      total_ttc: round2(totalTtc),
    })
    .eq("id", invoiceId)
    .eq("organization_id", orgId);

  return {
    code: "VAT_TOTAL_MISMATCH",
    fixed: hasFix,
    message: hasFix ? `Totaux recalculés sur ${lines.length} ligne(s).` : "Aucune ligne corrigible trouvée.",
    affectedTable: invoiceTable,
    affectedId: invoiceId,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fixMissingTaxRateId(supabase: any, orgId: string): Promise<AutoFixResult[]> {
  const results: AutoFixResult[] = [];

  const { data: custLines } = await supabase
    .from("customer_invoice_lines")
    .select("id, tax_rate, invoice_id")
    .eq("organization_id", orgId)
    .is("tax_rate_id", null)
    .not("tax_rate", "is", null);

  if (custLines && custLines.length > 0) {
    const { data: taxRates } = await supabase.from("tax_rates").select("id, rate").eq("organization_id", orgId);
    const rateMap = new Map<number, string>();
    for (const tr of (taxRates ?? []) as Array<{ id: string; rate: number }>) {
      rateMap.set(Number(tr.rate), tr.id);
    }

    for (const line of custLines as Array<{ id: string; tax_rate: number; invoice_id: string }>) {
      const rateId = rateMap.get(Number(line.tax_rate));
      if (rateId) {
        const { error } = await supabase.from("customer_invoice_lines").update({ tax_rate_id: rateId }).eq("id", line.id).eq("organization_id", orgId);
        results.push({
          code: "MISSING_TAX_RATE_ID",
          fixed: !error,
          message: error ? `Échec ligne client ${line.id}` : `Taux TVA lié (${line.tax_rate}%)`,
          affectedTable: "customer_invoice_lines",
          affectedId: line.invoice_id,
        });
      }
    }
  }

  const { data: suppLines } = await supabase
    .from("supplier_invoice_lines")
    .select("id, tax_rate, invoice_id")
    .eq("organization_id", orgId)
    .is("tax_rate_id", null)
    .not("tax_rate", "is", null);

  if (suppLines && suppLines.length > 0) {
    const { data: taxRates } = await supabase.from("tax_rates").select("id, rate").eq("organization_id", orgId);
    const rateMap = new Map<number, string>();
    for (const tr of (taxRates ?? []) as Array<{ id: string; rate: number }>) {
      rateMap.set(Number(tr.rate), tr.id);
    }

    for (const line of suppLines as Array<{ id: string; tax_rate: number; invoice_id: string }>) {
      const rateId = rateMap.get(Number(line.tax_rate));
      if (rateId) {
        const { error } = await supabase.from("supplier_invoice_lines").update({ tax_rate_id: rateId }).eq("id", line.id).eq("organization_id", orgId);
        results.push({
          code: "MISSING_TAX_RATE_ID",
          fixed: !error,
          message: error ? `Échec ligne fournisseur ${line.id}` : `Taux TVA lié (${line.tax_rate}%)`,
          affectedTable: "supplier_invoice_lines",
          affectedId: line.invoice_id,
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({ code: "MISSING_TAX_RATE_ID", fixed: false, message: "Aucune ligne avec tax_rate_id manquant trouvée." });
  }

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fixMissingUnitId(supabase: any, orgId: string): Promise<AutoFixResult[]> {
  const results: AutoFixResult[] = [];

  const { data: units } = await supabase.from("units").select("id, name, symbol").eq("organization_id", orgId);
  const unitMap = new Map<string, string>();
  for (const u of (units ?? []) as Array<{ id: string; name: string; symbol: string }>) {
    unitMap.set((u.name ?? "").toLowerCase(), u.id);
    unitMap.set((u.symbol ?? "").toLowerCase(), u.id);
  }

  const { data: custLines } = await supabase
    .from("customer_invoice_lines")
    .select("id, unit_name, invoice_id")
    .eq("organization_id", orgId)
    .is("unit_id", null)
    .not("unit_name", "is", null);

  for (const line of (custLines ?? []) as Array<{ id: string; unit_name: string; invoice_id: string }>) {
    const unitId = unitMap.get((line.unit_name ?? "").toLowerCase());
    if (unitId) {
      const { error } = await supabase.from("customer_invoice_lines").update({ unit_id: unitId }).eq("id", line.id).eq("organization_id", orgId);
      results.push({
        code: "MISSING_UNIT_ID",
        fixed: !error,
        message: error ? `Échec` : `Unité liée (${line.unit_name})`,
        affectedTable: "customer_invoice_lines",
        affectedId: line.invoice_id,
      });
    }
  }

  const { data: suppLines } = await supabase
    .from("supplier_invoice_lines")
    .select("id, unit_name, invoice_id")
    .eq("organization_id", orgId)
    .is("unit_id", null)
    .not("unit_name", "is", null);

  for (const line of (suppLines ?? []) as Array<{ id: string; unit_name: string; invoice_id: string }>) {
    const unitId = unitMap.get((line.unit_name ?? "").toLowerCase());
    if (unitId) {
      const { error } = await supabase.from("supplier_invoice_lines").update({ unit_id: unitId }).eq("id", line.id).eq("organization_id", orgId);
      results.push({
        code: "MISSING_UNIT_ID",
        fixed: !error,
        message: error ? `Échec` : `Unité liée (${line.unit_name})`,
        affectedTable: "supplier_invoice_lines",
        affectedId: line.invoice_id,
      });
    }
  }

  if (results.length === 0) {
    results.push({ code: "MISSING_UNIT_ID", fixed: false, message: "Aucune ligne avec unit_id manquant trouvée." });
  }

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalculateSupplierInvoicePaymentStatus(supabase: any, orgId: string): Promise<AutoFixResult[]> {
  const results: AutoFixResult[] = [];

  const { data: invoices } = await supabase
    .from("supplier_invoices")
    .select("id, total_ttc, paid_amount, remaining_amount, payment_status, status")
    .eq("organization_id", orgId)
    .in("status", ["validated", "partially_paid", "paid"]);

  for (const inv of (invoices ?? []) as Array<{ id: string; total_ttc: number; paid_amount: number; remaining_amount: number; payment_status: string; status: string }>) {
    const { data: allocs } = await supabase
      .from("supplier_payment_allocations")
      .select("amount")
      .eq("invoice_id", inv.id)
      .eq("organization_id", orgId)
      .is("cancelled_at", null);

    const computedPaid = (allocs ?? []).reduce((s: number, a: Record<string, unknown>) => s + Number(a.amount ?? 0), 0);
    const totalTtc = Number(inv.total_ttc ?? 0);
    const computedRemaining = Math.max(round2(totalTtc - computedPaid), 0);
    let paymentStatus = "unpaid";
    if (computedPaid >= totalTtc - 0.01 && totalTtc > 0) paymentStatus = "paid";
    else if (computedPaid > 0.01) paymentStatus = "partial";

    const storedPaid = Number(inv.paid_amount ?? 0);
    const storedRemaining = Number(inv.remaining_amount ?? 0);

    if (Math.abs(storedPaid - computedPaid) > 0.01 || Math.abs(storedRemaining - computedRemaining) > 0.01 || inv.payment_status !== paymentStatus) {
      const { error } = await supabase
        .from("supplier_invoices")
        .update({
          paid_amount: round2(computedPaid),
          remaining_amount: computedRemaining,
          payment_status: paymentStatus,
        })
        .eq("id", inv.id)
        .eq("organization_id", orgId);

      results.push({
        code: "PAYMENT_STATUS_MISMATCH",
        fixed: !error,
        message: error
          ? `Échec mise à jour FF ${inv.id}`
          : `Paiement recalculé : ${round2(computedPaid)} / ${round2(totalTtc)} MAD`,
        affectedTable: "supplier_invoices",
        affectedId: inv.id,
      });
    }
  }

  if (results.length === 0) {
    results.push({ code: "PAYMENT_STATUS_MISMATCH", fixed: false, message: "Aucun statut de paiement incohérent trouvé." });
  }

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalculateCustomerInvoicePaymentStatus(supabase: any, orgId: string): Promise<AutoFixResult[]> {
  const results: AutoFixResult[] = [];

  const { data: invoices } = await supabase
    .from("customer_invoices")
    .select("id, total_ttc, paid_amount, remaining_amount, payment_status, status")
    .eq("organization_id", orgId)
    .in("status", ["validated", "sent", "partially_paid", "paid", "overdue"]);

  for (const inv of (invoices ?? []) as Array<{ id: string; total_ttc: number; paid_amount: number; remaining_amount: number; payment_status: string; status: string }>) {
    const { data: allocs } = await supabase
      .from("customer_payment_allocations")
      .select("amount")
      .eq("invoice_id", inv.id)
      .eq("organization_id", orgId)
      .is("cancelled_at", null);

    const computedPaid = (allocs ?? []).reduce((s: number, a: Record<string, unknown>) => s + Number(a.amount ?? 0), 0);
    const totalTtc = Number(inv.total_ttc ?? 0);
    const computedRemaining = Math.max(round2(totalTtc - computedPaid), 0);
    let paymentStatus = "unpaid";
    if (computedPaid >= totalTtc - 0.01 && totalTtc > 0) paymentStatus = "paid";
    else if (computedPaid > 0.01) paymentStatus = "partial";

    const storedPaid = Number(inv.paid_amount ?? 0);
    const storedRemaining = Number(inv.remaining_amount ?? 0);

    if (Math.abs(storedPaid - computedPaid) > 0.01 || Math.abs(storedRemaining - computedRemaining) > 0.01 || inv.payment_status !== paymentStatus) {
      const { error } = await supabase
        .from("customer_invoices")
        .update({
          paid_amount: round2(computedPaid),
          remaining_amount: computedRemaining,
          payment_status: paymentStatus,
        })
        .eq("id", inv.id)
        .eq("organization_id", orgId);

      results.push({
        code: "PAYMENT_STATUS_MISMATCH",
        fixed: !error,
        message: error
          ? `Échec mise à jour FC ${inv.id}`
          : `Paiement recalculé : ${round2(computedPaid)} / ${round2(totalTtc)} MAD`,
        affectedTable: "customer_invoices",
        affectedId: inv.id,
      });
    }
  }

  if (results.length === 0) {
    results.push({ code: "PAYMENT_STATUS_MISMATCH", fixed: false, message: "Aucun statut de paiement client incohérent trouvé." });
  }

  return results;
}

export async function runVatAutoFixes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  issues: DgiVatValidationIssue[],
): Promise<{ results: AutoFixResult[]; fixedCount: number; skippedCount: number }> {
  const results: AutoFixResult[] = [];
  let fixedCount = 0;
  let skippedCount = 0;

  const issuesByCode = new Map<string, DgiVatValidationIssue[]>();
  for (const issue of issues) {
    const list = issuesByCode.get(issue.code) ?? [];
    list.push(issue);
    issuesByCode.set(issue.code, list);
  }

  const vatMismatchIssues = issuesByCode.get("VAT_TOTAL_MISMATCH") ?? [];
  for (const issue of vatMismatchIssues) {
    const sourceId = issue.sourceId;
    if (!sourceId) {
      results.push({ code: "VAT_TOTAL_MISMATCH", fixed: false, message: "ID source manquant." });
      skippedCount++;
      continue;
    }

    if (issue.source === "customer_invoice") {
      const res = await fixInvoiceLineTotals(supabase, orgId, sourceId, "customer_invoice_lines", "customer_invoices");
      results.push(res);
      if (res.fixed) fixedCount++;
      else skippedCount++;
    } else if (issue.source === "supplier_invoice") {
      const res = await fixInvoiceLineTotals(supabase, orgId, sourceId, "supplier_invoice_lines", "supplier_invoices");
      results.push(res);
      if (res.fixed) fixedCount++;
      else skippedCount++;
    } else {
      results.push({ code: "VAT_TOTAL_MISMATCH", fixed: false, message: `Source non gérée : ${issue.source}` });
      skippedCount++;
    }
  }

  const taxRateResults = await fixMissingTaxRateId(supabase, orgId);
  for (const r of taxRateResults) {
    results.push(r);
    if (r.fixed) fixedCount++;
    else skippedCount++;
  }

  const unitResults = await fixMissingUnitId(supabase, orgId);
  for (const r of unitResults) {
    results.push(r);
    if (r.fixed) fixedCount++;
    else skippedCount++;
  }

  const suppPaymentResults = await recalculateSupplierInvoicePaymentStatus(supabase, orgId);
  for (const r of suppPaymentResults) {
    results.push(r);
    if (r.fixed) fixedCount++;
    else skippedCount++;
  }

  const custPaymentResults = await recalculateCustomerInvoicePaymentStatus(supabase, orgId);
  for (const r of custPaymentResults) {
    results.push(r);
    if (r.fixed) fixedCount++;
    else skippedCount++;
  }

  return { results, fixedCount, skippedCount };
}
