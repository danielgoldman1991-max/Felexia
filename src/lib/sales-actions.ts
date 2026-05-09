"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { calculateSalesLine, calculateSalesTotals, isIndivisibleUnit } from "@/lib/sales-calculations";
import type { SalesActionResult, SalesDocumentType, SalesLineFormValue } from "@/lib/sales-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLines(formData: FormData): Record<string, unknown>[] {
  try {
    const raw = String(formData.get("lines") ?? "[]");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [];
  } catch {
    return [];
  }
}

function normalizeLines(rawLines: Record<string, unknown>[]): { lines: SalesLineFormValue[]; error?: string } {
  if (rawLines.length === 0) {
    return { lines: [], error: "Ajoutez au moins une ligne au devis." };
  }

  const lines: SalesLineFormValue[] = [];

  for (const [index, rawLine] of rawLines.entries()) {
    const line = calculateSalesLine({
      id: typeof rawLine.id === "string" && rawLine.id ? rawLine.id : `line-${index + 1}`,
      mode: rawLine.mode === "free" ? "free" : "product",
      product_id: typeof rawLine.product_id === "string" ? rawLine.product_id : "",
      product_name: typeof rawLine.product_name === "string" ? rawLine.product_name : "",
      description: typeof rawLine.description === "string" ? rawLine.description.trim() : "",
      quantity: numberFromUnknown(rawLine.quantity),
      unit_id: typeof rawLine.unit_id === "string" ? rawLine.unit_id : "",
      unit_name: typeof rawLine.unit_name === "string" ? rawLine.unit_name : "",
      unit_price_ht: numberFromUnknown(rawLine.unit_price_ht),
      discount_rate: numberFromUnknown(rawLine.discount_rate),
      tax_rate_id: typeof rawLine.tax_rate_id === "string" ? rawLine.tax_rate_id : "",
      tax_rate: numberFromUnknown(rawLine.tax_rate),
      subtotal_ht: numberFromUnknown(rawLine.subtotal_ht),
      tax_amount: numberFromUnknown(rawLine.tax_amount),
      total_ttc: numberFromUnknown(rawLine.total_ttc),
    });

    if (!line.description.trim()) {
      return { lines: [], error: `La description de la ligne ${index + 1} est obligatoire.` };
    }
    if (line.quantity <= 0) {
      return { lines: [], error: "Les quantites doivent etre superieures a zero." };
    }
    if (line.unit_price_ht < 0) {
      return { lines: [], error: "Le prix ne peut pas etre negatif." };
    }
    if (line.discount_rate < 0 || line.discount_rate > 100) {
      return { lines: [], error: "La remise doit etre comprise entre 0 et 100%." };
    }

    lines.push(line);
  }

  return { lines };
}

async function validateIndivisibleLineQuantities(organizationId: string, lines: SalesLineFormValue[]) {
  const unitIds = Array.from(new Set(lines.map((line) => line.unit_id).filter(Boolean)));
  const supabase = await createClient();
  let units: { id: string; name: string | null; symbol: string | null }[] = [];

  if (unitIds.length > 0) {
    const { data, error } = await supabase
      .from("units")
      .select("id, name, symbol")
      .eq("organization_id", organizationId)
      .in("id", unitIds);

    if (error) return { error: "Impossible de verifier les unites des lignes." };
    units = data ?? [];
  }

  const hasInvalidQuantity = lines.some(
    (line) => isIndivisibleUnit(line, units) && !Number.isInteger(Number(line.quantity)),
  );

  if (hasInvalidQuantity) {
    return { error: "La quantite doit etre un nombre entier pour les articles en unite U." };
  }

  return {};
}

async function insertLines(documentId: string, organizationId: string, lines: SalesLineFormValue[]) {
  const supabase = await createClient();
  const payload = lines.map((line, index) => ({
    organization_id: organizationId,
    document_id: documentId,
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
    tax_amount: line.tax_amount,
    total_ttc: line.total_ttc,
  }));

  return supabase.from("sales_document_lines").insert(payload);
}

async function copyLinesToDocument(sourceDocumentId: string, targetDocumentId: string, organizationId: string) {
  const supabase = await createClient();
  const { data: lines, error } = await supabase
    .from("sales_document_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("document_id", sourceDocumentId)
    .order("line_order", { ascending: true });

  if (error) return { error };
  if (!lines || lines.length === 0) return { error: { message: "Le document source ne contient aucune ligne." } };

  const payload = lines.map((line) => ({
    organization_id: organizationId,
    document_id: targetDocumentId,
    line_order: line.line_order,
    product_id: line.product_id,
    product_name: line.product_name,
    description: line.description,
    quantity: line.quantity,
    unit_id: line.unit_id,
    unit_name: line.unit_name,
    unit_price_ht: line.unit_price_ht,
    discount_rate: line.discount_rate,
    tax_rate_id: line.tax_rate_id,
    tax_rate: line.tax_rate,
    subtotal_ht: line.subtotal_ht,
    tax_amount: line.tax_amount,
    total_ttc: line.total_ttc,
  }));

  return supabase.from("sales_document_lines").insert(payload);
}

export async function createSalesQuote(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client." };

  const normalized = normalizeLines(parseLines(formData));
  if (normalized.error) return { success: false, error: normalized.error };
  const lines = normalized.lines;
  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };

  const totals = calculateSalesTotals(lines);
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "quote",
      document_number: "",
      customer_id: customerId,
      document_date: text(formData, "document_date") ?? new Date().toISOString().split("T")[0],
      valid_until: text(formData, "valid_until"),
      status: "draft",
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    })
    .select("id, document_number")
    .single();

  if (error || !document) {
    return { success: false, error: error?.message ?? "Impossible de creer le devis." };
  }

  const { error: lineError } = await insertLines(document.id, workspace.organization.id, lines);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente");
  revalidatePath("/vente/devis");
  redirect(`/vente/devis/${document.id}`);
}

export async function updateSalesQuote(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant devis manquant." };

  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client." };

  const normalized = normalizeLines(parseLines(formData));
  if (normalized.error) return { success: false, error: normalized.error };
  const lines = normalized.lines;
  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };

  const totals = calculateSalesTotals(lines);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("sales_documents")
    .select("status, document_type")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) return { success: false, error: "Devis introuvable." };
  if (existing.document_type !== "quote") return { success: false, error: "Ce document n'est pas un devis." };
  if (existing.status !== "draft") return { success: false, error: "Seul un devis brouillon peut etre modifie." };

  const { error: updateError } = await supabase
    .from("sales_documents")
    .update({
      customer_id: customerId,
      document_date: text(formData, "document_date"),
      valid_until: text(formData, "valid_until"),
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (updateError) return { success: false, error: updateError.message };

  const { error: deleteError } = await supabase
    .from("sales_document_lines")
    .delete()
    .eq("organization_id", workspace.organization.id)
    .eq("document_id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  const { error: lineError } = await insertLines(id, workspace.organization.id, lines);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente/devis");
  revalidatePath(`/vente/devis/${id}`);
  redirect(`/vente/devis/${id}`);
}

export async function createSalesOrder(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client." };

  const normalized = normalizeLines(parseLines(formData));
  if (normalized.error) return { success: false, error: normalized.error };
  const lines = normalized.lines;
  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };

  const totals = calculateSalesTotals(lines);
  const supabase = await createClient();

  const { data: document, error } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "order",
      document_number: "",
      customer_id: customerId,
      document_date: text(formData, "document_date") ?? new Date().toISOString().split("T")[0],
      expected_delivery_date: text(formData, "expected_delivery_date"),
      status: "draft",
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    })
    .select("id, document_number")
    .single();

  if (error || !document) {
    return { success: false, error: error?.message ?? "Impossible de creer la commande." };
  }

  const { error: lineError } = await insertLines(document.id, workspace.organization.id, lines);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente");
  revalidatePath("/vente/commandes");
  redirect(`/vente/commandes/${document.id}`);
}

export async function updateSalesOrder(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant commande manquant." };

  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Selectionnez un client." };

  const normalized = normalizeLines(parseLines(formData));
  if (normalized.error) return { success: false, error: normalized.error };
  const lines = normalized.lines;
  const unitValidation = await validateIndivisibleLineQuantities(workspace.organization.id, lines);
  if (unitValidation.error) return { success: false, error: unitValidation.error };

  const totals = calculateSalesTotals(lines);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("sales_documents")
    .select("status, document_type")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) return { success: false, error: "Commande introuvable." };
  if (existing.document_type !== "order") return { success: false, error: "Ce document n'est pas une commande." };
  if (existing.status !== "draft") return { success: false, error: "Seule une commande brouillon peut etre modifiee." };

  const { error: updateError } = await supabase
    .from("sales_documents")
    .update({
      customer_id: customerId,
      document_date: text(formData, "document_date"),
      expected_delivery_date: text(formData, "expected_delivery_date"),
      subtotal_ht: totals.subtotal_ht,
      tax_total: totals.tax_total,
      total_ttc: totals.total_ttc,
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (updateError) return { success: false, error: updateError.message };

  const { error: deleteError } = await supabase
    .from("sales_document_lines")
    .delete()
    .eq("organization_id", workspace.organization.id)
    .eq("document_id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  const { error: lineError } = await insertLines(id, workspace.organization.id, lines);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente/commandes");
  revalidatePath(`/vente/commandes/${id}`);
  redirect(`/vente/commandes/${id}`);
}

export async function archiveSalesDocument(
  previousState: SalesActionResult,
  formData: FormData,
): Promise<SalesActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  const documentType = text(formData, "document_type") as SalesDocumentType | null;
  if (!id) return { success: false, error: "Document introuvable." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_documents")
    .update({ status: "cancelled", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/vente");
  if (documentType === "order") redirect("/vente/commandes");
  if (documentType === "delivery_note") redirect("/vente/livraisons");
  redirect("/vente/devis");
}

async function updateDocumentStatus(
  id: string,
  status: string,
  allowedType: SalesDocumentType,
  allowedStatuses?: string[],
) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data: document, error: fetchError } = await supabase
    .from("sales_documents")
    .select("document_type, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !document) return { success: false, error: "Document introuvable." };
  if (document.document_type !== allowedType) return { success: false, error: "Type de document invalide." };
  if (allowedStatuses && !allowedStatuses.includes(document.status)) {
    return { success: false, error: "Ce document ne peut pas changer de statut dans son etat actuel." };
  }

  const { error } = await supabase
    .from("sales_documents")
    .update({ status })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function markQuoteAsSent(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Devis introuvable." };
  const result = await updateDocumentStatus(id, "sent", "quote");
  revalidatePath(`/vente/devis/${id}`);
  return result;
}

export async function acceptQuote(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Devis introuvable." };
  const result = await updateDocumentStatus(id, "accepted", "quote");
  revalidatePath(`/vente/devis/${id}`);
  return result;
}

export async function rejectQuote(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Devis introuvable." };
  const result = await updateDocumentStatus(id, "rejected", "quote");
  revalidatePath(`/vente/devis/${id}`);
  return result;
}

export async function convertQuoteToOrder(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Devis introuvable." };
  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("sales_documents")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (quoteError || !quote) return { success: false, error: "Devis introuvable." };
  if (quote.document_type !== "quote") return { success: false, error: "Ce document n'est pas un devis." };
  if (!["draft", "sent", "accepted"].includes(quote.status)) {
    return { success: false, error: "Ce devis ne peut pas etre converti." };
  }

  const { data: order, error: orderError } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "order",
      document_number: "",
      customer_id: quote.customer_id,
      source_document_id: quote.id,
      document_date: new Date().toISOString().split("T")[0],
      status: "draft",
      subtotal_ht: quote.subtotal_ht,
      tax_total: quote.tax_total,
      total_ttc: quote.total_ttc,
      notes: quote.notes,
      internal_notes: quote.internal_notes,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (orderError || !order) return { success: false, error: orderError?.message ?? "Impossible de creer la commande." };

  const { error: lineError } = await copyLinesToDocument(quote.id, order.id, workspace.organization.id);
  if (lineError) return { success: false, error: lineError.message };

  await supabase
    .from("sales_documents")
    .update({ status: "converted" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", quote.id);

  revalidatePath("/vente/devis");
  revalidatePath("/vente/commandes");
  redirect(`/vente/commandes/${order.id}`);
}

export async function confirmOrder(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Commande introuvable." };
  const result = await updateDocumentStatus(id, "confirmed", "order", ["draft"]);
  revalidatePath(`/vente/commandes/${id}`);
  return result;
}

export async function createDeliveryFromOrder(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Commande introuvable." };
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("sales_documents")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();

  if (orderError || !order) return { success: false, error: "Commande introuvable." };
  if (order.document_type !== "order") return { success: false, error: "Ce document n'est pas une commande." };
  if (order.status !== "confirmed") {
    return { success: false, error: "Confirmez la commande avant de creer un bon de livraison." };
  }

  const { data: delivery, error: deliveryError } = await supabase
    .from("sales_documents")
    .insert({
      organization_id: workspace.organization.id,
      document_type: "delivery_note",
      document_number: "",
      customer_id: order.customer_id,
      source_document_id: order.id,
      document_date: new Date().toISOString().split("T")[0],
      status: "draft",
      subtotal_ht: order.subtotal_ht,
      tax_total: order.tax_total,
      total_ttc: order.total_ttc,
      notes: order.notes,
      internal_notes: order.internal_notes,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (deliveryError || !delivery) return { success: false, error: deliveryError?.message ?? "Impossible de creer le bon de livraison." };

  const { error: lineError } = await copyLinesToDocument(order.id, delivery.id, workspace.organization.id);
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/vente/commandes");
  revalidatePath("/vente/livraisons");
  redirect(`/vente/livraisons/${delivery.id}`);
}

export async function validateDeliveryNote(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Bon de livraison introuvable." };
  const result = await updateDocumentStatus(id, "validated", "delivery_note", ["draft"]);
  revalidatePath(`/vente/livraisons/${id}`);
  return result;
}

export async function markDeliveryAsDelivered(prev: SalesActionResult, formData: FormData): Promise<SalesActionResult> {
  void prev;
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Bon de livraison introuvable." };
  const result = await updateDocumentStatus(id, "delivered", "delivery_note", ["validated"]);
  revalidatePath(`/vente/livraisons/${id}`);
  return result;
}
