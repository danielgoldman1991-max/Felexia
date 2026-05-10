"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { calculateInvoiceLine, calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { getDeliveryNotesInvoicePreparation, listBillableDeliveryNotesByCustomer } from "@/lib/invoices";
import { isIndivisibleUnit } from "@/lib/sales-calculations";
import type { InvoiceActionResult, InvoiceLineFormValue } from "@/lib/invoice-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLines(formData: FormData): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(String(formData.get("lines") ?? "[]"));
    return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [];
  } catch {
    return [];
  }
}

function parseStringArray(formData: FormData, key: string) {
  try {
    const parsed = JSON.parse(String(formData.get(key) ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
  } catch {
    return [];
  }
}

function normalizeInvoiceLines(rawLines: Record<string, unknown>[]) {
  if (rawLines.length === 0) return { lines: [] as InvoiceLineFormValue[], error: "Ajoutez au moins une ligne a la facture." };

  const lines: InvoiceLineFormValue[] = [];
  for (const [index, raw] of rawLines.entries()) {
    const line = calculateInvoiceLine({
      id: typeof raw.id === "string" && raw.id ? raw.id : `line-${index + 1}`,
      mode: raw.mode === "free" ? "free" : "product",
      product_id: typeof raw.product_id === "string" ? raw.product_id : "",
      product_name: typeof raw.product_name === "string" ? raw.product_name : "",
      description: typeof raw.description === "string" ? raw.description.trim() : "",
      quantity: numberValue(raw.quantity),
      unit_id: typeof raw.unit_id === "string" ? raw.unit_id : "",
      unit_name: typeof raw.unit_name === "string" ? raw.unit_name : "",
      unit_price_ht: numberValue(raw.unit_price_ht),
      discount_rate: numberValue(raw.discount_rate),
      tax_rate_id: typeof raw.tax_rate_id === "string" ? raw.tax_rate_id : "",
      tax_rate: numberValue(raw.tax_rate),
      subtotal_ht: numberValue(raw.subtotal_ht),
      discount_amount: numberValue(raw.discount_amount),
      tax_amount: numberValue(raw.tax_amount),
      total_ttc: numberValue(raw.total_ttc),
      source_line_id: typeof raw.source_line_id === "string" ? raw.source_line_id : null,
      source_document_id: typeof raw.source_document_id === "string" ? raw.source_document_id : null,
    });

    if (!line.description) return { lines: [], error: `La description de la ligne ${index + 1} est obligatoire.` };
    if (line.quantity <= 0) return { lines: [], error: "Les quantites doivent etre superieures a zero." };
    if (line.unit_price_ht < 0) return { lines: [], error: "Le prix ne peut pas etre negatif." };
    if (line.discount_rate < 0 || line.discount_rate > 100) return { lines: [], error: "La remise doit etre comprise entre 0 et 100%." };
    lines.push(line);
  }

  return { lines };
}

async function validateUnits(organizationId: string, lines: InvoiceLineFormValue[]) {
  const unitIds = Array.from(new Set(lines.map((line) => line.unit_id).filter(Boolean)));
  if (unitIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("units").select("id, name, symbol").eq("organization_id", organizationId).in("id", unitIds);
  if (error) return { error: "Impossible de verifier les unites." };
  if (lines.some((line) => isIndivisibleUnit(line, data ?? []) && !Number.isInteger(Number(line.quantity)))) {
    return { error: "La quantite doit etre entiere pour les lignes en unite U." };
  }
  return {};
}

async function validateDeliveryNotesNotInvoiced(organizationId: string, deliveryNoteIds: string[], excludeInvoiceId?: string | null) {
  const uniqueIds = Array.from(new Set(deliveryNoteIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};
  const supabase = await createClient();
  const { data: invoiceLines, error: lineError } = await supabase
    .from("customer_invoice_lines")
    .select("invoice_id, source_document_id")
    .eq("organization_id", organizationId)
    .in("source_document_id", uniqueIds);
  if (lineError) return { error: lineError.message };

  const invoiceIds = Array.from(new Set((invoiceLines ?? []).map((line) => line.invoice_id).filter(Boolean))) as string[];
  const candidateInvoiceIds = excludeInvoiceId ? invoiceIds.filter((id) => id !== excludeInvoiceId) : invoiceIds;
  if (candidateInvoiceIds.length === 0) return {};

  const { data: invoices, error: invoiceError } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, status")
    .eq("organization_id", organizationId)
    .in("id", candidateInvoiceIds)
    .neq("status", "cancelled")
    .is("archived_at", null);
  if (invoiceError) return { error: invoiceError.message };
  if ((invoices ?? []).length > 0) {
    return { error: `Un bon de livraison selectionne est deja rattache a la facture ${(invoices ?? [])[0].invoice_number}.` };
  }
  return {};
}

function linePayload(invoiceId: string, organizationId: string, line: InvoiceLineFormValue, index: number) {
  return {
    organization_id: organizationId,
    invoice_id: invoiceId,
    line_order: index + 1,
    source_line_id: line.source_line_id ?? null,
    source_document_id: line.source_document_id ?? null,
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

async function buildInvoicePayload(formData: FormData) {
  const workspace = await requireActiveWorkspace();
  const customerId = text(formData, "customer_id");
  const normalized = normalizeInvoiceLines(parseLines(formData));
  if (!customerId) return { workspace, error: "Selectionnez un client." };
  if (normalized.error) return { workspace, error: normalized.error };

  const unitValidation = await validateUnits(workspace.organization.id, normalized.lines);
  if (unitValidation.error) return { workspace, error: unitValidation.error };
  const totals = calculateInvoiceTotals(normalized.lines);
  const paidAmount = numberValue(formData.get("paid_amount"));
  const selectedDeliveryNoteIds = parseStringArray(formData, "selected_delivery_note_ids");
  const lineDeliveryNoteIds = Array.from(new Set(normalized.lines.map((line) => line.source_document_id).filter(Boolean))) as string[];
  const deliveryNoteIds = selectedDeliveryNoteIds.length > 0 ? selectedDeliveryNoteIds : lineDeliveryNoteIds;
  const deliveryValidation = await validateDeliveryNotesNotInvoiced(
    workspace.organization.id,
    deliveryNoteIds,
    text(formData, "id"),
  );
  if (deliveryValidation.error) return { workspace, error: deliveryValidation.error };

  const sourceType = deliveryNoteIds.length > 1
    ? "grouped_delivery_notes"
    : deliveryNoteIds.length === 1
      ? "delivery_note"
      : text(formData, "source_type") ?? "manual";
  const singleDeliveryId = deliveryNoteIds.length === 1 ? deliveryNoteIds[0] : null;

  return {
    workspace,
    lines: normalized.lines,
    totals,
    payload: {
      organization_id: workspace.organization.id,
      invoice_number: "",
      customer_id: customerId,
      source_type: sourceType,
      source_document_id: singleDeliveryId ?? text(formData, "source_document_id"),
      source_order_id: text(formData, "source_order_id"),
      source_delivery_id: singleDeliveryId ?? text(formData, "source_delivery_id"),
      invoice_date: text(formData, "invoice_date") ?? new Date().toISOString().split("T")[0],
      due_date: text(formData, "due_date"),
      payment_terms_days: Math.trunc(numberValue(formData.get("payment_terms_days"))),
      payment_terms: text(formData, "payment_terms"),
      payment_method: text(formData, "payment_method"),
      custom_payment_terms: text(formData, "custom_payment_terms"),
      custom_payment_method: text(formData, "custom_payment_method"),
      paid_amount: paidAmount,
      remaining_amount: Math.max(totals.total_ttc - paidAmount, 0),
      subtotal_ht: totals.subtotal_ht,
      discount_total: totals.discount_total,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    },
  };
}

export async function prepareInvoiceLinesFromDeliveryNotes(customerId: string, deliveryNoteIds: string[]): Promise<InvoiceActionResult> {
  try {
    const prepared = await getDeliveryNotesInvoicePreparation(customerId, deliveryNoteIds);
    return { success: true, data: prepared };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Impossible d'importer les bons de livraison." };
  }
}

export async function listBillableDeliveryNotesForInvoice(customerId: string): Promise<InvoiceActionResult> {
  try {
    const deliveryNotes = await listBillableDeliveryNotesByCustomer(customerId);
    return { success: true, data: { deliveryNotes } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Impossible de charger les bons de livraison." };
  }
}

export async function createCustomerInvoice(prev: InvoiceActionResult, formData: FormData): Promise<InvoiceActionResult> {
  void prev;
  const built = await buildInvoicePayload(formData);
  if (built.error) return { success: false, error: built.error };
  if (!built.payload) return { success: false, error: "Facture invalide." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("customer_invoices").insert(built.payload).select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Impossible de creer la facture." };
  const { error: lineError } = await supabase
    .from("customer_invoice_lines")
    .insert(built.lines.map((line, index) => linePayload(data.id, built.workspace.organization.id, line, index)));
  if (lineError) return { success: false, error: lineError.message };
  revalidatePath("/facturation/factures");
  redirect(`/facturation/factures/${data.id}`);
}

export async function updateCustomerInvoice(prev: InvoiceActionResult, formData: FormData): Promise<InvoiceActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Facture introuvable." };
  const built = await buildInvoicePayload(formData);
  if (built.error) return { success: false, error: built.error };
  if (!built.payload) return { success: false, error: "Facture invalide." };
  const supabase = await createClient();
  const { data: invoice, error: fetchError } = await supabase
    .from("customer_invoices")
    .select("id, status")
    .eq("organization_id", built.workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !invoice) return { success: false, error: "Facture introuvable." };
  if (invoice.status !== "draft") return { success: false, error: "Seule une facture brouillon est modifiable." };
  const { error } = await supabase.from("customer_invoices").update(built.payload).eq("organization_id", built.workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  await supabase.from("customer_invoice_lines").delete().eq("organization_id", built.workspace.organization.id).eq("invoice_id", id);
  const { error: lineError } = await supabase
    .from("customer_invoice_lines")
    .insert(built.lines.map((line, index) => linePayload(id, built.workspace.organization.id, line, index)));
  if (lineError) return { success: false, error: lineError.message };
  revalidatePath(`/facturation/factures/${id}`);
  redirect(`/facturation/factures/${id}`);
}

async function updateInvoiceStatus(id: string, status: string, expected: string[]) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("customer_invoices")
    .select("id, status, total_ttc, paid_amount")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (error || !invoice) return { success: false, error: "Facture introuvable." };
  if (!expected.includes(invoice.status as string)) return { success: false, error: "Statut facture incompatible." };
  const payload: Record<string, unknown> = { status };
  if (status === "validated") {
    if (Number(invoice.total_ttc ?? 0) <= 0) return { success: false, error: "Le total TTC doit etre superieur a zero." };
    payload.validated_at = new Date().toISOString();
    payload.remaining_amount = Math.max(Number(invoice.total_ttc ?? 0) - Number(invoice.paid_amount ?? 0), 0);
  }
  if (status === "sent") payload.sent_at = new Date().toISOString();
  if (status === "cancelled") payload.cancelled_at = new Date().toISOString();
  const { error: updateError } = await supabase.from("customer_invoices").update(payload).eq("organization_id", workspace.organization.id).eq("id", id);
  if (updateError) return { success: false, error: updateError.message };
  revalidatePath(`/facturation/factures/${id}`);
  return { success: true };
}

export async function validateCustomerInvoice(prev: InvoiceActionResult, formData: FormData) {
  void prev;
  return updateInvoiceStatus(String(formData.get("id") ?? ""), "validated", ["draft"]);
}

export async function markInvoiceAsSent(prev: InvoiceActionResult, formData: FormData) {
  void prev;
  return updateInvoiceStatus(String(formData.get("id") ?? ""), "sent", ["validated"]);
}

export async function cancelCustomerInvoice(prev: InvoiceActionResult, formData: FormData) {
  void prev;
  return updateInvoiceStatus(String(formData.get("id") ?? ""), "cancelled", ["draft", "validated", "sent"]);
}

export async function archiveCustomerInvoice(prev: InvoiceActionResult, formData: FormData) {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Facture introuvable." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_invoices")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/facturation/factures");
  redirect("/facturation/factures");
}

export const createInvoiceFromOrder = createCustomerInvoice;
export const createInvoiceFromDeliveryNote = createCustomerInvoice;
