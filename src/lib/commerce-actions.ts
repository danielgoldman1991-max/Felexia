"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { calculateLine, calculateTotals } from "@/lib/commerce-calculations";
import type { CommerceActionResult, CommerceLineFormValue } from "@/lib/commerce-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function numberOrZero(formData: FormData, key: string) {
  const value = numberValue(formData, key);
  return value === null || Number.isNaN(value) ? 0 : value;
}

function parseJsonField(formData: FormData, key: string): Record<string, unknown>[] {
  try {
    const raw = text(formData, key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCommerceLines(rawLines: Record<string, unknown>[]): { lines: CommerceLineFormValue[]; error?: string } {
  if (rawLines.length === 0) {
    return { lines: [], error: "Au moins une ligne est requise." };
  }

  const lines: CommerceLineFormValue[] = [];

  for (const [index, rawLine] of rawLines.entries()) {
    const preparedLine = calculateLine({
      id: typeof rawLine.id === "string" && rawLine.id ? rawLine.id : `line-${index + 1}`,
      mode: rawLine.mode === "product" ? "product" : "free",
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

    if (!preparedLine.description) {
      return { lines: [], error: `La description de la ligne ${index + 1} est obligatoire.` };
    }

    if (!Number.isFinite(preparedLine.quantity) || preparedLine.quantity <= 0) {
      return { lines: [], error: "Les quantites doivent etre superieures a 0." };
    }

    if (!Number.isFinite(preparedLine.unit_price_ht) || preparedLine.unit_price_ht < 0) {
      return { lines: [], error: "Les prix doivent etre positifs." };
    }

    if (!Number.isFinite(preparedLine.discount_rate) || preparedLine.discount_rate < 0 || preparedLine.discount_rate > 100) {
      return { lines: [], error: "La remise doit etre comprise entre 0 et 100%." };
    }

    lines.push(preparedLine);
  }

  return { lines };
}

// =============================================
// SALES QUOTES
// =============================================

export async function createSalesQuote(
  previousState: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();

  const third_party_id = text(formData, "third_party_id");
  if (!third_party_id) return { success: false, error: "Le client est obligatoire." };

  const normalizedLines = normalizeCommerceLines(parseJsonField(formData, "lines"));
  if (normalizedLines.error) return { success: false, error: normalizedLines.error };
  const lines = normalizedLines.lines;

  const contact_id = text(formData, "contact_id");
  const document_date = text(formData, "document_date") ?? new Date().toISOString().split("T")[0];
  const valid_until = text(formData, "valid_until");
  const payment_terms_days = numberOrZero(formData, "payment_terms_days");
  const notes = text(formData, "notes");
  const internal_notes = text(formData, "internal_notes");

  const totals = calculateTotals(lines);

  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("sales_quotes")
    .insert({
      organization_id: workspace.organization.id,
      third_party_id,
      contact_id,
      document_date,
      valid_until,
      status: "draft",
      currency: "MAD",
      payment_terms_days,
      subtotal: totals.subtotal_ht,
      subtotal_ht: totals.subtotal_ht,
      discount_total: 0,
      tax_total: totals.tax_total,
      total: totals.total_ttc,
      total_ttc: totals.total_ttc,
      notes,
      internal_notes,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (quoteError) return { success: false, error: quoteError.message };

  for (const [idx, line] of lines.entries()) {
    const { error: lineError } = await supabase
      .from("sales_quote_lines")
      .insert({
        organization_id: workspace.organization.id,
        quote_id: quote.id,
        product_id: line.product_id || null,
        line_order: idx + 1,
        description: String(line.description ?? ""),
        quantity: Number(line.quantity) || 0,
        unit_id: line.unit_id || null,
        unit_price: Number(line.unit_price_ht) || 0,
        unit_price_ht: Number(line.unit_price_ht) || 0,
        discount_rate: line.discount_rate,
        tax_rate_id: line.tax_rate_id || null,
        tax_rate: line.tax_rate,
        tax_amount: line.tax_amount,
        subtotal_ht: line.subtotal_ht,
        line_total: line.total_ttc,
        total_ttc: line.total_ttc,
      });

    if (lineError) return { success: false, error: lineError.message };
  }

  revalidatePath("/devis");
  revalidatePath(`/devis/${quote.id}`);
  redirect(`/devis/${quote.id}`);
}

export async function updateSalesQuote(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant devis manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sales_quotes")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Devis introuvable." };
  if (!["draft", "sent"].includes(existing.status)) {
    return { success: false, error: "Ce devis ne peut pas etre modifie." };
  }

  const third_party_id = text(formData, "third_party_id");
  if (!third_party_id) return { success: false, error: "Le client est obligatoire." };

  const normalizedLines = normalizeCommerceLines(parseJsonField(formData, "lines"));
  if (normalizedLines.error) return { success: false, error: normalizedLines.error };
  const lines = normalizedLines.lines;

  const contact_id = text(formData, "contact_id");
  const document_date = text(formData, "document_date") ?? new Date().toISOString().split("T")[0];
  const valid_until = text(formData, "valid_until");
  const payment_terms_days = numberOrZero(formData, "payment_terms_days");
  const notes = text(formData, "notes");
  const internal_notes = text(formData, "internal_notes");

  const totals = calculateTotals(lines);

  const { error: deleteError } = await supabase
    .from("sales_quote_lines")
    .delete()
    .eq("organization_id", workspace.organization.id)
    .eq("quote_id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  for (const [idx, line] of lines.entries()) {
    const { error: lineError } = await supabase
      .from("sales_quote_lines")
      .insert({
        organization_id: workspace.organization.id,
        quote_id: id,
        product_id: line.product_id || null,
        line_order: idx + 1,
        description: String(line.description ?? ""),
        quantity: Number(line.quantity) || 0,
        unit_id: line.unit_id || null,
        unit_price: Number(line.unit_price_ht) || 0,
        unit_price_ht: Number(line.unit_price_ht) || 0,
        discount_rate: line.discount_rate,
        tax_rate_id: line.tax_rate_id || null,
        tax_rate: line.tax_rate,
        tax_amount: line.tax_amount,
        subtotal_ht: line.subtotal_ht,
        line_total: line.total_ttc,
        total_ttc: line.total_ttc,
      });

    if (lineError) return { success: false, error: lineError.message };
  }

  const { error: updateError } = await supabase
    .from("sales_quotes")
    .update({
      third_party_id,
      contact_id,
      document_date,
      valid_until,
      payment_terms_days,
      subtotal: totals.subtotal_ht,
      subtotal_ht: totals.subtotal_ht,
      discount_total: 0,
      tax_total: totals.tax_total,
      total: totals.total_ttc,
      total_ttc: totals.total_ttc,
      notes,
      internal_notes,
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/devis");
  revalidatePath(`/devis/${id}`);
  redirect(`/devis/${id}`);
}

export async function archiveSalesQuote(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant devis manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_quotes")
    .update({ status: "cancelled", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: "Impossible d'archiver ce devis." };

  revalidatePath("/devis");
  redirect("/devis");
}

export async function sendSalesQuote(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant devis manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sales_quotes")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Devis introuvable." };
  if (existing.status !== "draft") return { success: false, error: "Seul un brouillon peut etre envoye." };

  const { error } = await supabase
    .from("sales_quotes")
    .update({ status: "sent" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/devis");
  return { success: true };
}

export async function acceptSalesQuote(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant devis manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sales_quotes")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Devis introuvable." };
  if (existing.status !== "sent") return { success: false, error: "Seul un devis envoye peut etre accepte." };

  const { error } = await supabase
    .from("sales_quotes")
    .update({ status: "accepted" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/devis");
  return { success: true };
}

export async function rejectSalesQuote(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant devis manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sales_quotes")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Devis introuvable." };
  if (existing.status !== "sent") return { success: false, error: "Seul un devis envoye peut etre rejete." };

  const { error } = await supabase
    .from("sales_quotes")
    .update({ status: "rejected" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/devis");
  return { success: true };
}

export async function convertQuoteToOrder(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const quote_id = text(formData, "quote_id");
  if (!quote_id) return { success: false, error: "Identifiant devis manquant." };

  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("sales_quotes")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", quote_id)
    .single();

  if (quoteError || !quote) return { success: false, error: "Devis introuvable." };
  if (!["draft", "sent", "accepted"].includes(quote.status)) {
    return { success: false, error: "Ce devis ne peut pas etre converti en commande." };
  }

  const { data: quoteLines } = await supabase
    .from("sales_quote_lines")
    .select("*")
    .eq("quote_id", quote_id);

  if (!quoteLines || quoteLines.length === 0) {
    return { success: false, error: "Le devis doit contenir au moins une ligne." };
  }

  const { data: order, error: orderError } = await supabase
    .from("sales_orders")
    .insert({
      organization_id: workspace.organization.id,
      quote_id,
      third_party_id: quote.third_party_id,
      contact_id: quote.contact_id,
      document_date: new Date().toISOString().split("T")[0],
      status: "draft",
      currency: quote.currency,
      payment_terms_days: quote.payment_terms_days,
      subtotal: quote.subtotal,
      subtotal_ht: quote.subtotal_ht,
      discount_total: quote.discount_total,
      tax_total: quote.tax_total,
      total: quote.total,
      total_ttc: quote.total_ttc,
      delivered_total: 0,
      notes: quote.notes,
      internal_notes: quote.internal_notes,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (orderError) return { success: false, error: orderError.message };

  for (const ql of quoteLines) {
    const { error: lineError } = await supabase
      .from("sales_order_lines")
      .insert({
        organization_id: workspace.organization.id,
        order_id: order.id,
        quote_line_id: ql.id,
        product_id: ql.product_id,
        line_order: ql.line_order,
        description: ql.description,
        quantity: ql.quantity,
        delivered_quantity: 0,
        unit_id: ql.unit_id,
        unit_price: ql.unit_price,
        unit_price_ht: ql.unit_price_ht,
        discount_rate: ql.discount_rate,
        tax_rate_id: ql.tax_rate_id,
        tax_rate: ql.tax_rate,
        tax_amount: ql.tax_amount,
        subtotal_ht: ql.subtotal_ht,
        line_total: ql.line_total,
        total_ttc: ql.total_ttc,
      });

    if (lineError) return { success: false, error: lineError.message };
  }

  const { error: updateError } = await supabase
    .from("sales_quotes")
    .update({
      status: "converted",
      converted_order_id: order.id,
      converted_at: new Date().toISOString(),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", quote_id);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/devis");
  redirect(`/commandes/${order.id}`);
}

// =============================================
// SALES ORDERS
// =============================================

export async function createSalesOrder(
  previousState: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();

  const third_party_id = text(formData, "third_party_id");
  if (!third_party_id) return { success: false, error: "Le client est obligatoire." };

  const lines = parseJsonField(formData, "lines");
  if (lines.length === 0) return { success: false, error: "Au moins une ligne est requise." };

  for (const line of lines) {
    const qty = Number(line.quantity);
    const price = Number(line.unit_price_ht);
    if (!Number.isFinite(qty) || qty <= 0) return { success: false, error: "Les quantites doivent etre superieures a 0." };
    if (!Number.isFinite(price) || price < 0) return { success: false, error: "Les prix doivent etre positifs." };
  }

  const contact_id = text(formData, "contact_id");
  const document_date = text(formData, "document_date") ?? new Date().toISOString().split("T")[0];
  const expected_delivery_date = text(formData, "expected_delivery_date");
  const payment_terms_days = numberOrZero(formData, "payment_terms_days");
  const notes = text(formData, "notes");
  const internal_notes = text(formData, "internal_notes");

  const totals = lines.reduce<{ subtotal_ht: number; tax_total: number; total_ttc: number }>(
    (acc, line) => ({
      subtotal_ht: acc.subtotal_ht + (Number(line.subtotal_ht) || 0),
      tax_total: acc.tax_total + (Number(line.tax_amount) || 0),
      total_ttc: acc.total_ttc + (Number(line.total_ttc) || 0),
    }),
    { subtotal_ht: 0, tax_total: 0, total_ttc: 0 },
  );

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("sales_orders")
    .insert({
      organization_id: workspace.organization.id,
      third_party_id,
      contact_id,
      document_date,
      expected_delivery_date,
      status: "draft",
      currency: "EUR",
      payment_terms_days,
      subtotal: totals.subtotal_ht,
      subtotal_ht: totals.subtotal_ht,
      discount_total: 0,
      tax_total: totals.tax_total,
      total: totals.total_ttc,
      total_ttc: totals.total_ttc,
      delivered_total: 0,
      notes,
      internal_notes,
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (orderError) return { success: false, error: orderError.message };

  for (const [idx, line] of lines.entries()) {
    const subtotalHt = Number(line.subtotal_ht) || 0;
    const discountRate = Number(line.discount_rate) || 0;
    const lineTotal = Math.round(subtotalHt * (1 - discountRate / 100) * 100) / 100;

    const { error: lineError } = await supabase
      .from("sales_order_lines")
      .insert({
        organization_id: workspace.organization.id,
        order_id: order.id,
        product_id: line.product_id ?? null,
        line_order: idx + 1,
        description: String(line.description ?? ""),
        quantity: Number(line.quantity) || 0,
        delivered_quantity: 0,
        unit_id: line.unit_id ?? null,
        unit_price: Number(line.unit_price_ht) || 0,
        unit_price_ht: Number(line.unit_price_ht) || 0,
        discount_rate: discountRate,
        tax_rate_id: line.tax_rate_id ?? null,
        tax_rate: Number(line.tax_rate) || 0,
        tax_amount: Number(line.tax_amount) || 0,
        subtotal_ht: subtotalHt,
        line_total: lineTotal,
        total_ttc: Number(line.total_ttc) || 0,
      });

    if (lineError) return { success: false, error: lineError.message };
  }

  revalidatePath("/commandes");
  revalidatePath(`/commandes/${order.id}`);
  redirect(`/commandes/${order.id}`);
}

export async function updateSalesOrder(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant commande manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sales_orders")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Commande introuvable." };
  if (existing.status !== "draft") return { success: false, error: "Seul un brouillon peut etre modifie." };

  const third_party_id = text(formData, "third_party_id");
  if (!third_party_id) return { success: false, error: "Le client est obligatoire." };

  const lines = parseJsonField(formData, "lines");
  if (lines.length === 0) return { success: false, error: "Au moins une ligne est requise." };

  for (const line of lines) {
    const qty = Number(line.quantity);
    const price = Number(line.unit_price_ht);
    if (!Number.isFinite(qty) || qty <= 0) return { success: false, error: "Les quantites doivent etre superieures a 0." };
    if (!Number.isFinite(price) || price < 0) return { success: false, error: "Les prix doivent etre positifs." };
  }

  const contact_id = text(formData, "contact_id");
  const document_date = text(formData, "document_date") ?? new Date().toISOString().split("T")[0];
  const expected_delivery_date = text(formData, "expected_delivery_date");
  const payment_terms_days = numberOrZero(formData, "payment_terms_days");
  const notes = text(formData, "notes");
  const internal_notes = text(formData, "internal_notes");

  const totals = lines.reduce<{ subtotal_ht: number; tax_total: number; total_ttc: number }>(
    (acc, line) => ({
      subtotal_ht: acc.subtotal_ht + (Number(line.subtotal_ht) || 0),
      tax_total: acc.tax_total + (Number(line.tax_amount) || 0),
      total_ttc: acc.total_ttc + (Number(line.total_ttc) || 0),
    }),
    { subtotal_ht: 0, tax_total: 0, total_ttc: 0 },
  );

  const { error: deleteError } = await supabase
    .from("sales_order_lines")
    .delete()
    .eq("order_id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  for (const [idx, line] of lines.entries()) {
    const subtotalHt = Number(line.subtotal_ht) || 0;
    const discountRate = Number(line.discount_rate) || 0;
    const lineTotal = Math.round(subtotalHt * (1 - discountRate / 100) * 100) / 100;

    const { error: lineError } = await supabase
      .from("sales_order_lines")
      .insert({
        organization_id: workspace.organization.id,
        order_id: id,
        product_id: line.product_id ?? null,
        line_order: idx + 1,
        description: String(line.description ?? ""),
        quantity: Number(line.quantity) || 0,
        delivered_quantity: 0,
        unit_id: line.unit_id ?? null,
        unit_price: Number(line.unit_price_ht) || 0,
        unit_price_ht: Number(line.unit_price_ht) || 0,
        discount_rate: discountRate,
        tax_rate_id: line.tax_rate_id ?? null,
        tax_rate: Number(line.tax_rate) || 0,
        tax_amount: Number(line.tax_amount) || 0,
        subtotal_ht: subtotalHt,
        line_total: lineTotal,
        total_ttc: Number(line.total_ttc) || 0,
      });

    if (lineError) return { success: false, error: lineError.message };
  }

  const { error: updateError } = await supabase
    .from("sales_orders")
    .update({
      third_party_id,
      contact_id,
      document_date,
      expected_delivery_date,
      payment_terms_days,
      subtotal: totals.subtotal_ht,
      subtotal_ht: totals.subtotal_ht,
      discount_total: 0,
      tax_total: totals.tax_total,
      total: totals.total_ttc,
      total_ttc: totals.total_ttc,
      notes,
      internal_notes,
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/commandes");
  revalidatePath(`/commandes/${id}`);
  redirect(`/commandes/${id}`);
}

export async function archiveSalesOrder(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant commande manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_orders")
    .update({ status: "cancelled", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: "Impossible d'archiver cette commande." };

  revalidatePath("/commandes");
  redirect("/commandes");
}

export async function confirmSalesOrder(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant commande manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sales_orders")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Commande introuvable." };
  if (existing.status !== "draft") return { success: false, error: "Seul un brouillon peut etre confirme." };

  const { error } = await supabase
    .from("sales_orders")
    .update({ status: "confirmed" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/commandes");
  return { success: true };
}

export async function createDeliveryFromOrder(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const order_id = text(formData, "order_id");
  if (!order_id) return { success: false, error: "Identifiant commande manquant." };

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("sales_orders")
    .select("*")
    .eq("organization_id", workspace.organization.id)
    .eq("id", order_id)
    .single();

  if (orderError || !order) return { success: false, error: "Commande introuvable." };
  if (!["confirmed", "partially_delivered"].includes(order.status)) {
    return { success: false, error: "Cette commande ne peut pas etre livree." };
  }

  const lines = parseJsonField(formData, "lines");
  if (lines.length === 0) return { success: false, error: "Au moins une ligne est requise." };

  const document_date = text(formData, "document_date") ?? new Date().toISOString().split("T")[0];

  const { data: delivery, error: deliveryError } = await supabase
    .from("delivery_notes")
    .insert({
      organization_id: workspace.organization.id,
      order_id,
      third_party_id: order.third_party_id,
      contact_id: order.contact_id,
      document_date,
      status: "draft",
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (deliveryError) return { success: false, error: deliveryError.message };

  for (const [idx, line] of lines.entries()) {
    const { error: lineError } = await supabase
      .from("delivery_note_lines")
      .insert({
        organization_id: workspace.organization.id,
        delivery_note_id: delivery.id,
        order_line_id: line.order_line_id ?? null,
        product_id: line.product_id ?? null,
        line_order: idx + 1,
        description: String(line.description ?? ""),
        quantity: Number(line.quantity) || 0,
        delivered_quantity: Number(line.delivered_quantity) || Number(line.quantity) || 0,
        unit_id: line.unit_id ?? null,
      });

    if (lineError) return { success: false, error: lineError.message };
  }

  revalidatePath("/livraisons");
  redirect(`/livraisons/${delivery.id}`);
}

// =============================================
// DELIVERY NOTES
// =============================================

export async function createDeliveryNote(
  previousState: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void previousState;
  const workspace = await requireActiveWorkspace();

  const third_party_id = text(formData, "third_party_id");
  if (!third_party_id) return { success: false, error: "Le client est obligatoire." };

  const lines = parseJsonField(formData, "lines");
  if (lines.length === 0) return { success: false, error: "Au moins une ligne est requise." };

  const supabase = await createClient();

  const { data: delivery, error: deliveryError } = await supabase
    .from("delivery_notes")
    .insert({
      organization_id: workspace.organization.id,
      order_id: text(formData, "order_id"),
      third_party_id,
      contact_id: text(formData, "contact_id"),
      document_date: text(formData, "document_date") ?? new Date().toISOString().split("T")[0],
      delivery_date: text(formData, "delivery_date"),
      delivery_address: text(formData, "delivery_address"),
      status: "draft",
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    })
    .select("id")
    .single();

  if (deliveryError) return { success: false, error: deliveryError.message };

  for (const [idx, line] of lines.entries()) {
    const { error: lineError } = await supabase
      .from("delivery_note_lines")
      .insert({
        organization_id: workspace.organization.id,
        delivery_note_id: delivery.id,
        order_line_id: line.order_line_id ?? null,
        product_id: line.product_id ?? null,
        line_order: idx + 1,
        description: String(line.description ?? ""),
        quantity: Number(line.quantity) || 0,
        delivered_quantity: Number(line.delivered_quantity) || Number(line.quantity) || 0,
        unit_id: line.unit_id ?? null,
      });

    if (lineError) return { success: false, error: lineError.message };
  }

  revalidatePath("/livraisons");
  revalidatePath(`/livraisons/${delivery.id}`);
  redirect(`/livraisons/${delivery.id}`);
}

export async function updateDeliveryNote(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant bon de livraison manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("delivery_notes")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Bon de livraison introuvable." };
  if (existing.status !== "draft") return { success: false, error: "Ce bon de livraison ne peut pas etre modifie." };

  const lines = parseJsonField(formData, "lines");

  const { error: deleteError } = await supabase
    .from("delivery_note_lines")
    .delete()
    .eq("delivery_note_id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  for (const [idx, line] of lines.entries()) {
    const { error: lineError } = await supabase
      .from("delivery_note_lines")
      .insert({
        organization_id: workspace.organization.id,
        delivery_note_id: id,
        order_line_id: line.order_line_id ?? null,
        product_id: line.product_id ?? null,
        line_order: idx + 1,
        description: String(line.description ?? ""),
        quantity: Number(line.quantity) || 0,
        delivered_quantity: Number(line.delivered_quantity) || Number(line.quantity) || 0,
        unit_id: line.unit_id ?? null,
      });

    if (lineError) return { success: false, error: lineError.message };
  }

  const { error: updateError } = await supabase
    .from("delivery_notes")
    .update({
      third_party_id: text(formData, "third_party_id"),
      contact_id: text(formData, "contact_id"),
      document_date: text(formData, "document_date"),
      delivery_date: text(formData, "delivery_date"),
      delivery_address: text(formData, "delivery_address"),
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/livraisons");
  revalidatePath(`/livraisons/${id}`);
  redirect(`/livraisons/${id}`);
}

export async function archiveDeliveryNote(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant bon de livraison manquant." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_notes")
    .update({ status: "cancelled", archived_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: "Impossible d'archiver ce bon de livraison." };

  revalidatePath("/livraisons");
  redirect("/livraisons");
}

export async function validateDeliveryNote(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant bon de livraison manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("delivery_notes")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Bon de livraison introuvable." };
  if (existing.status !== "draft") return { success: false, error: "Seul un brouillon peut etre valide." };

  const { error } = await supabase
    .from("delivery_notes")
    .update({ status: "validated" })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/livraisons");
  return { success: true };
}

export async function markDeliveryAsDelivered(
  prev: CommerceActionResult,
  formData: FormData,
): Promise<CommerceActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();

  const id = text(formData, "id");
  if (!id) return { success: false, error: "Identifiant bon de livraison manquant." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("delivery_notes")
    .select("status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .single();

  if (!existing) return { success: false, error: "Bon de livraison introuvable." };
  if (existing.status !== "validated") return { success: false, error: "Seul un bon valide peut etre marque comme livre." };

  const { error } = await supabase
    .from("delivery_notes")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/livraisons");
  return { success: true };
}
