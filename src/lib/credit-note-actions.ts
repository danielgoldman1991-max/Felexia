"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { calculateInvoiceLine, calculateInvoiceTotals, getCustomerCreditNoteDetail, getCreditNoteReturnPreparation } from "@/lib/credit-notes";
import { createClient } from "@/lib/supabase/server";
import type { CreditNoteActionResult, CreditNoteLineFormValue } from "@/lib/credit-note-types";
import type { InvoiceLineFormValue } from "@/lib/invoice-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLines(formData: FormData): CreditNoteLineFormValue[] {
  try {
    const parsed = JSON.parse(String(formData.get("lines") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((raw, index) => {
      const item = raw as Record<string, unknown>;
      return {
        id: typeof item.id === "string" ? item.id : `line-${index}`,
        source_invoice_line_id: typeof item.source_line_id === "string" ? item.source_line_id : typeof item.source_invoice_line_id === "string" ? item.source_invoice_line_id : null,
        source_return_line_id: typeof item.source_return_line_id === "string" ? item.source_return_line_id : typeof item.return_line_id === "string" ? item.return_line_id : null,
        product_id: typeof item.product_id === "string" ? item.product_id : null,
        product_name: typeof item.product_name === "string" ? item.product_name : null,
        description: typeof item.description === "string" ? item.description : "",
        quantity: numberValue(item.quantity),
        unit_id: typeof item.unit_id === "string" ? item.unit_id : null,
        unit_name: typeof item.unit_name === "string" ? item.unit_name : null,
        unit_price_ht: numberValue(item.unit_price_ht),
        discount_rate: numberValue(item.discount_rate),
        tax_rate_id: typeof item.tax_rate_id === "string" ? item.tax_rate_id : null,
        tax_rate: numberValue(item.tax_rate),
      };
    });
  } catch {
    return [];
  }
}

function normalizeLine(line: CreditNoteLineFormValue): InvoiceLineFormValue {
  return calculateInvoiceLine({
    id: line.id,
    mode: line.product_id ? "product" : "free",
    product_id: line.product_id ?? "",
    product_name: line.product_name ?? "",
    description: line.description,
    quantity: line.quantity,
    unit_id: line.unit_id ?? "",
    unit_name: line.unit_name ?? "",
    unit_price_ht: line.unit_price_ht,
    discount_rate: line.discount_rate,
    tax_rate_id: line.tax_rate_id ?? "",
    tax_rate: line.tax_rate,
    subtotal_ht: 0,
    discount_amount: 0,
    tax_amount: 0,
    total_ttc: 0,
  });
}

function linePayload(organizationId: string, creditNoteId: string, line: InvoiceLineFormValue, sourceInvoiceLineId: string | null, index: number) {
  return {
    organization_id: organizationId,
    credit_note_id: creditNoteId,
    source_invoice_line_id: sourceInvoiceLineId,
    line_order: index + 1,
    product_id: line.product_id || null,
    product_name: line.product_name || null,
    description: line.description,
    quantity: line.quantity,
    unit_id: line.unit_id || null,
    unit_name: line.unit_name || null,
    unit_price_ht: line.unit_price_ht,
    discount_rate: line.discount_rate,
    tax_rate_id: line.tax_rate_id || null,
    tax_rate: line.tax_rate,
    subtotal_ht: line.subtotal_ht,
    discount_amount: line.discount_amount,
    tax_amount: line.tax_amount,
    total_ttc: line.total_ttc,
  };
}

export async function createCustomerCreditNote(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  if (text(formData, "source_type") === "return" || text(formData, "source_return_id")) {
    return createCreditNoteFromReturn({ success: true }, formData);
  }
  const workspace = await requireActiveWorkspace();
  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client." };
  const rawLines = parseLines(formData);
  if (rawLines.length === 0) return { success: false, error: "Ajoutez au moins une ligne a l'avoir." };
  const lines = rawLines.map(normalizeLine);
  if (lines.some((line) => !line.description || line.quantity <= 0 || line.unit_price_ht < 0)) return { success: false, error: "Verifiez les lignes de l'avoir." };
  const totals = calculateInvoiceTotals(lines);
  if (totals.total_ttc <= 0) return { success: false, error: "Le total de l'avoir doit etre superieur a zero." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_credit_notes")
    .insert({
      organization_id: workspace.organization.id,
      credit_note_number: "",
      customer_id: customerId,
      source_invoice_id: text(formData, "source_invoice_id"),
      source_return_id: text(formData, "source_return_id"),
      source_type: text(formData, "source_type") ?? "manual",
      credit_note_date: text(formData, "credit_note_date") ?? new Date().toISOString().split("T")[0],
      subtotal_ht: totals.subtotal_ht,
      discount_total: totals.discount_total,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      applied_amount: 0,
      available_amount: 0,
      reason: text(formData, "reason"),
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Impossible de creer l'avoir." };

  const { error: lineError } = await supabase.from("customer_credit_note_lines").insert(
    lines.map((line, index) => linePayload(workspace.organization.id, data.id, line, rawLines[index].source_invoice_line_id ?? null, index)),
  );
  if (lineError) return { success: false, error: lineError.message };
  revalidatePath("/facturation/avoirs");
  redirect(`/facturation/avoirs/${data.id}`);
}

export const createCreditNoteFromInvoice = createCustomerCreditNote;

export async function createCreditNoteFromReturn(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const returnId = text(formData, "source_return_id") ?? text(formData, "return_id");
  if (!returnId) return { success: false, error: "Bon de retour introuvable." };

  const supabase = await createClient();
  const { data: returnDocument, error: returnError } = await supabase
    .from("sales_documents")
    .select("id, organization_id, customer_id, document_type, document_number, status, return_reason, archived_at")
    .eq("organization_id", workspace.organization.id)
    .eq("id", returnId)
    .maybeSingle();
  if (returnError) return { success: false, error: returnError.message };
  if (!returnDocument || returnDocument.document_type !== "return_note") return { success: false, error: "Bon de retour introuvable." };
  if (returnDocument.archived_at) return { success: false, error: "Impossible de creer un avoir depuis un retour archive." };
  if (returnDocument.status !== "validated") return { success: false, error: "Validez d'abord le bon de retour avant de creer un avoir." };

  const { data: existingCreditNote, error: existingError } = await supabase
    .from("customer_credit_notes")
    .select("id")
    .eq("organization_id", workspace.organization.id)
    .eq("source_return_id", returnId)
    .neq("status", "cancelled")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (existingError) return { success: false, error: existingError.message };
  if (existingCreditNote) return { success: false, error: "Ce bon de retour est deja rattache a un avoir client." };

  const rawLines = parseLines(formData);
  if (rawLines.length === 0) return { success: false, error: "Ajoutez au moins une ligne a l'avoir." };
  const lines = rawLines.map(normalizeLine);
  if (lines.some((line) => !line.description || line.quantity <= 0 || line.unit_price_ht < 0)) return { success: false, error: "Verifiez les lignes de l'avoir." };
  const totals = calculateInvoiceTotals(lines);
  if (totals.total_ttc <= 0) return { success: false, error: "Le total de l'avoir doit etre superieur a zero." };

  let sourceInvoiceId = text(formData, "source_invoice_id");
  if (!sourceInvoiceId) {
    const preparation = await getCreditNoteReturnPreparation(returnId);
    sourceInvoiceId = preparation.relatedInvoice?.id ?? null;
  }

  const { data, error } = await supabase
    .from("customer_credit_notes")
    .insert({
      organization_id: workspace.organization.id,
      credit_note_number: "",
      customer_id: returnDocument.customer_id,
      source_type: "return",
      source_return_id: returnId,
      source_invoice_id: sourceInvoiceId,
      credit_note_date: text(formData, "credit_note_date") ?? new Date().toISOString().split("T")[0],
      subtotal_ht: totals.subtotal_ht,
      discount_total: totals.discount_total,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      applied_amount: 0,
      available_amount: 0,
      reason: text(formData, "reason") ?? returnDocument.return_reason ?? "Avoir suite retour client",
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Impossible de creer l'avoir." };

  const { error: lineError } = await supabase.from("customer_credit_note_lines").insert(
    lines.map((line, index) => linePayload(workspace.organization.id, data.id, line, rawLines[index].source_invoice_line_id ?? null, index)),
  );
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath(`/vente/retours/${returnId}`);
  revalidatePath("/facturation/avoirs");
  redirect(`/facturation/avoirs/${data.id}`);
}

async function recalculateCreditNote(organizationId: string, creditNoteId: string) {
  const supabase = await createClient();
  const [{ data: note }, { data: applications, error }] = await Promise.all([
    supabase.from("customer_credit_notes").select("id, total_ttc, status").eq("organization_id", organizationId).eq("id", creditNoteId).maybeSingle(),
    supabase.from("customer_credit_note_applications").select("amount").eq("organization_id", organizationId).eq("credit_note_id", creditNoteId).is("cancelled_at", null),
  ]);
  if (!note) return { error: "Avoir introuvable." };
  if (error) return { error: error.message };
  if (note.status === "cancelled" || note.status === "draft") return {};
  const applied = (applications ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const total = Number(note.total_ttc ?? 0);
  const available = Math.max(total - applied, 0);
  const status = applied <= 0 ? "validated" : available > 0 ? "partially_applied" : "applied";
  const { error: updateError } = await supabase.from("customer_credit_notes").update({ applied_amount: applied, available_amount: available, status }).eq("organization_id", organizationId).eq("id", creditNoteId);
  return updateError ? { error: updateError.message } : {};
}

export async function recalculateInvoiceFinancialStatus(organizationId: string, invoiceId: string) {
  const supabase = await createClient();
  const [{ data: invoice }, { data: applications, error }] = await Promise.all([
    supabase.from("customer_invoices").select("id, total_ttc, paid_amount, status").eq("organization_id", organizationId).eq("id", invoiceId).maybeSingle(),
    supabase.from("customer_credit_note_applications").select("amount").eq("organization_id", organizationId).eq("invoice_id", invoiceId).is("cancelled_at", null),
  ]);
  if (!invoice) return { error: "Facture introuvable." };
  if (error) return { error: error.message };
  if (invoice.status === "cancelled") return {};
  const creditAmount = (applications ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const total = Number(invoice.total_ttc ?? 0);
  const paid = Number(invoice.paid_amount ?? 0);
  const remaining = Math.max(total - paid - creditAmount, 0);
  const paymentStatus = remaining <= 0 ? "paid" : paid > 0 || creditAmount > 0 ? "partial" : "unpaid";
  const status = paymentStatus === "paid" ? "paid" : paymentStatus === "partial" ? "partially_paid" : invoice.status;
  const { error: updateError } = await supabase.from("customer_invoices").update({ credit_amount: creditAmount, remaining_amount: remaining, payment_status: paymentStatus, status }).eq("organization_id", organizationId).eq("id", invoiceId);
  return updateError ? { error: updateError.message } : {};
}

export async function validateCustomerCreditNote(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Avoir introuvable." };
  const supabase = await createClient();
  const { data: note } = await supabase.from("customer_credit_notes").select("id, status, total_ttc, source_return_id").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (!note) return { success: false, error: "Avoir introuvable." };
  if (note.status !== "draft") return { success: false, error: "Seul un avoir brouillon peut etre valide." };
  if (Number(note.total_ttc ?? 0) <= 0) return { success: false, error: "Le total de l'avoir doit etre superieur a zero." };
  if (note.source_return_id) {
    const { data: returnDocument, error: returnError } = await supabase
      .from("sales_documents")
      .select("id, document_type, status")
      .eq("organization_id", workspace.organization.id)
      .eq("id", note.source_return_id)
      .maybeSingle();
    if (returnError) return { success: false, error: returnError.message };
    if (!returnDocument || returnDocument.document_type !== "return_note" || returnDocument.status !== "validated") {
      return { success: false, error: "Validez d'abord le bon de retour avant de valider cet avoir." };
    }
  }
  const { error } = await supabase.from("customer_credit_notes").update({ status: "validated", validated_at: new Date().toISOString(), available_amount: Number(note.total_ttc ?? 0) }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/facturation/avoirs/${id}`);
  return { success: true };
}

export async function cancelCustomerCreditNote(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Avoir introuvable." };
  const { creditNote, applications } = await getCustomerCreditNoteDetail(id);
  if (!creditNote) return { success: false, error: "Avoir introuvable." };
  if (applications.length > 0) return { success: false, error: "Retirez les affectations avant d'annuler l'avoir." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_credit_notes").update({ status: "cancelled", cancelled_at: new Date().toISOString(), available_amount: 0 }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/facturation/avoirs/${id}`);
  return { success: true };
}

function parseApplications(formData: FormData) {
  try {
    const parsed = JSON.parse(String(formData.get("applications") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => item as Record<string, unknown>).map((item) => ({ invoice_id: String(item.invoice_id ?? ""), amount: numberValue(item.amount) })).filter((item) => item.invoice_id && item.amount > 0);
  } catch {
    return [];
  }
}

export async function applyCreditNoteToInvoices(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const creditNoteId = text(formData, "credit_note_id");
  if (!creditNoteId) return { success: false, error: "Avoir introuvable." };
  const applications = parseApplications(formData);
  if (applications.length === 0) return { success: false, error: "Saisissez au moins une affectation." };
  const { creditNote } = await getCustomerCreditNoteDetail(creditNoteId);
  if (!creditNote || !["validated", "partially_applied"].includes(creditNote.status)) return { success: false, error: "Avoir non affectable." };
  const total = applications.reduce((sum, item) => sum + item.amount, 0);
  if (total > creditNote.available_amount) return { success: false, error: "Le montant affecte depasse le disponible de l'avoir." };
  const supabase = await createClient();
  const { data: invoices, error: invoiceError } = await supabase.from("customer_invoices").select("id, customer_id, remaining_amount, status").eq("organization_id", workspace.organization.id).in("id", applications.map((item) => item.invoice_id));
  if (invoiceError) return { success: false, error: invoiceError.message };
  for (const application of applications) {
    const invoice = (invoices ?? []).find((item) => item.id === application.invoice_id);
    if (!invoice || invoice.customer_id !== creditNote.customer_id) return { success: false, error: "L'avoir et la facture doivent appartenir au meme client." };
    if (invoice.status === "cancelled") return { success: false, error: "Impossible d'affecter une facture annulee." };
    if (application.amount > Number(invoice.remaining_amount ?? 0)) return { success: false, error: "Le montant affecte depasse le reste a payer d'une facture." };
  }
  const { error } = await supabase.from("customer_credit_note_applications").insert(applications.map((application) => ({ organization_id: workspace.organization.id, credit_note_id: creditNoteId, invoice_id: application.invoice_id, customer_id: creditNote.customer_id, amount: application.amount, created_by: workspace.userId })));
  if (error) return { success: false, error: error.message };
  for (const application of applications) await recalculateInvoiceFinancialStatus(workspace.organization.id, application.invoice_id);
  const result = await recalculateCreditNote(workspace.organization.id, creditNoteId);
  if (result.error) return { success: false, error: result.error };
  revalidatePath(`/facturation/avoirs/${creditNoteId}`);
  revalidatePath("/facturation/factures");
  redirect(`/facturation/avoirs/${creditNoteId}`);
}

export async function unapplyCreditNoteFromInvoice(prev: CreditNoteActionResult, formData: FormData): Promise<CreditNoteActionResult> {
  void prev;
  void formData;
  return { success: false, error: "Retrait d'affectation prevu dans une prochaine iteration." };
}
