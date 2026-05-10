"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { getCustomerOpenItems } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import type { PaymentActionResult } from "@/lib/payment-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAllocations(formData: FormData): { invoice_id: string; amount: number; notes?: string | null }[] {
  try {
    const parsed = JSON.parse(String(formData.get("allocations") ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => item as Record<string, unknown>)
      .map((item) => ({
        invoice_id: typeof item.invoice_id === "string" ? item.invoice_id : "",
        amount: numberValue(item.amount),
        notes: typeof item.notes === "string" ? item.notes : null,
      }))
      .filter((item) => item.invoice_id && item.amount > 0);
  } catch {
    return [];
  }
}

export async function getCustomerOpenItemsAction(thirdPartyId: string): Promise<PaymentActionResult> {
  if (!thirdPartyId) return { success: false, error: "Selectionnez un client." };
  try {
    const data = await getCustomerOpenItems(thirdPartyId);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Impossible de charger les echeances du client." };
  }
}

async function recalculateInvoicePaymentStatus(organizationId: string, invoiceId: string) {
  const supabase = await createClient();
  const [{ data: invoice, error: invoiceError }, { data: allocations, error: allocationError }] = await Promise.all([
    supabase
      .from("customer_invoices")
      .select("id, total_ttc, paid_amount, credit_amount, status")
      .eq("organization_id", organizationId)
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase
      .from("customer_payment_allocations")
      .select("amount")
      .eq("organization_id", organizationId)
      .eq("invoice_id", invoiceId)
      .is("cancelled_at", null),
  ]);
  if (invoiceError || !invoice) return { error: "Facture introuvable." };
  if (allocationError) return { error: allocationError.message };
  if (invoice.status === "cancelled") return {};

  const total = Number(invoice.total_ttc ?? 0);
  const paid = (allocations ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const credit = Number(invoice.credit_amount ?? 0);
  const remaining = Math.max(total - paid - credit, 0);
  const settled = paid + credit >= total && total > 0;
  const paymentStatus = settled ? "paid" : paid > 0 || credit > 0 ? "partial" : "unpaid";
  const nextStatus = paymentStatus === "paid" ? "paid" : paymentStatus === "partial" ? "partially_paid" : invoice.status;
  const { error } = await supabase
    .from("customer_invoices")
    .update({
      paid_amount: paid,
      remaining_amount: remaining,
      payment_status: paymentStatus,
      status: nextStatus,
    })
    .eq("organization_id", organizationId)
    .eq("id", invoiceId);
  return error ? { error: error.message } : {};
}

async function recalculatePaymentAllocationStatus(organizationId: string, paymentId: string) {
  const supabase = await createClient();
  const [{ data: payment, error: paymentError }, { data: allocations, error: allocationError }] = await Promise.all([
    supabase.from("customer_payments").select("id, amount, status").eq("organization_id", organizationId).eq("id", paymentId).maybeSingle(),
    supabase.from("customer_payment_allocations").select("amount").eq("organization_id", organizationId).eq("payment_id", paymentId).is("cancelled_at", null),
  ]);
  if (paymentError || !payment) return { error: "Paiement introuvable." };
  if (allocationError) return { error: allocationError.message };
  if (payment.status === "cancelled") return {};
  const amount = Number(payment.amount ?? 0);
  const allocated = (allocations ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const available = Math.max(amount - allocated, 0);
  const status = allocated <= 0 ? "confirmed" : available > 0 ? "partially_allocated" : "allocated";
  const { error } = await supabase
    .from("customer_payments")
    .update({ allocated_amount: allocated, available_amount: available, status })
    .eq("organization_id", organizationId)
    .eq("id", paymentId);
  return error ? { error: error.message } : {};
}

async function validateThirdParty(organizationId: string, thirdPartyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("third_parties")
    .select("id, types")
    .eq("organization_id", organizationId)
    .eq("id", thirdPartyId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) return { error: "Client introuvable." };
  const types = Array.isArray(data.types) ? data.types : [];
  if (!types.includes("customer")) return { error: "Le tiers selectionne doit etre un client." };
  return {};
}

async function validateAllocationTargets(organizationId: string, thirdPartyId: string, allocations: { invoice_id: string; amount: number }[]) {
  if (allocations.length === 0) return { invoices: [] as Record<string, unknown>[] };
  const supabase = await createClient();
  const ids = Array.from(new Set(allocations.map((allocation) => allocation.invoice_id)));
  const { data: invoices, error } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, customer_id, remaining_amount, status")
    .eq("organization_id", organizationId)
    .in("id", ids);
  if (error) return { error: error.message };
  if ((invoices ?? []).length !== ids.length) return { error: "Une facture selectionnee est introuvable." };
  for (const allocation of allocations) {
    const invoice = (invoices ?? []).find((item) => item.id === allocation.invoice_id);
    if (!invoice || invoice.customer_id !== thirdPartyId) return { error: "Le paiement et la facture doivent appartenir au meme client." };
    if (invoice.status === "cancelled") return { error: "Impossible d'affecter une facture annulee." };
    if (allocation.amount > Number(invoice.remaining_amount ?? 0)) return { error: `Le montant depasse le reste a payer de ${invoice.invoice_number}.` };
  }
  return { invoices: invoices ?? [] };
}

async function createAllocationRows(
  organizationId: string,
  userId: string,
  paymentId: string,
  thirdPartyId: string,
  allocations: { invoice_id: string; amount: number; notes?: string | null }[],
) {
  if (allocations.length === 0) return {};
  const validation = await validateAllocationTargets(organizationId, thirdPartyId, allocations);
  if (validation.error) return { error: validation.error };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_payment_allocations").insert(
    allocations.map((allocation) => ({
      organization_id: organizationId,
      payment_id: paymentId,
      invoice_id: allocation.invoice_id,
      third_party_id: thirdPartyId,
      customer_id: thirdPartyId,
      amount: allocation.amount,
      notes: allocation.notes ?? null,
      created_by: userId,
    })),
  );
  if (error) return { error: error.message };
  for (const allocation of allocations) {
    const result = await recalculateInvoicePaymentStatus(organizationId, allocation.invoice_id);
    if (result.error) return result;
  }
  return recalculatePaymentAllocationStatus(organizationId, paymentId);
}

export async function createCustomerPayment(prev: PaymentActionResult, formData: FormData): Promise<PaymentActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const thirdPartyId = text(formData, "third_party_id") ?? text(formData, "customer_id");
  const amount = numberValue(formData.get("amount"));
  const paymentMethod = text(formData, "payment_method");
  if (!thirdPartyId) return { success: false, error: "Selectionnez un client." };
  if (amount <= 0) return { success: false, error: "Le montant doit etre superieur a zero." };
  if (!paymentMethod) return { success: false, error: "Selectionnez une modalite de paiement." };
  const thirdPartyValidation = await validateThirdParty(workspace.organization.id, thirdPartyId);
  if (thirdPartyValidation.error) return { success: false, error: thirdPartyValidation.error };

  const allocations = parseAllocations(formData);
  const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (allocatedTotal > amount) return { success: false, error: "Le montant affecte depasse le paiement disponible." };
  const validation = await validateAllocationTargets(workspace.organization.id, thirdPartyId, allocations);
  if (validation.error) return { success: false, error: validation.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_payments")
    .insert({
      organization_id: workspace.organization.id,
      payment_number: "",
      third_party_id: thirdPartyId,
      customer_id: thirdPartyId,
      payment_date: text(formData, "payment_date") ?? new Date().toISOString().split("T")[0],
      value_date: text(formData, "value_date"),
      amount,
      allocated_amount: 0,
      available_amount: amount,
      currency: "MAD",
      payment_method: paymentMethod,
      reference: text(formData, "reference"),
      bank_name: text(formData, "bank_name"),
      check_number: text(formData, "check_number"),
      transfer_reference: text(formData, "transfer_reference"),
      due_date: text(formData, "due_date"),
      status: "confirmed",
      payment_type: text(formData, "payment_type") ?? "customer_payment",
      source_type: text(formData, "source_type") ?? "manual",
      source_invoice_id: text(formData, "source_invoice_id"),
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
      confirmed_at: new Date().toISOString(),
      created_by: workspace.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Impossible de creer le paiement." };

  const allocationResult = await createAllocationRows(workspace.organization.id, workspace.userId, data.id, thirdPartyId, allocations);
  if (allocationResult.error) return { success: false, error: allocationResult.error };
  revalidatePath("/facturation/paiements");
  revalidatePath("/facturation/factures");
  redirect(`/facturation/paiements/${data.id}`);
}

export async function updateCustomerPayment(prev: PaymentActionResult, formData: FormData): Promise<PaymentActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Paiement introuvable." };
  const amount = numberValue(formData.get("amount"));
  if (amount <= 0) return { success: false, error: "Le montant doit etre superieur a zero." };
  const supabase = await createClient();
  const { data: payment } = await supabase.from("customer_payments").select("allocated_amount").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (!payment) return { success: false, error: "Paiement introuvable." };
  if (amount < Number(payment.allocated_amount ?? 0)) return { success: false, error: "Le montant ne peut pas etre inferieur au montant deja affecte." };
  const { error } = await supabase
    .from("customer_payments")
    .update({
      payment_date: text(formData, "payment_date"),
      value_date: text(formData, "value_date"),
      amount,
      available_amount: amount - Number(payment.allocated_amount ?? 0),
      payment_method: text(formData, "payment_method"),
      reference: text(formData, "reference"),
      bank_name: text(formData, "bank_name"),
      check_number: text(formData, "check_number"),
      transfer_reference: text(formData, "transfer_reference"),
      due_date: text(formData, "due_date"),
      payment_type: text(formData, "payment_type") ?? "customer_payment",
      notes: text(formData, "notes"),
      internal_notes: text(formData, "internal_notes"),
    })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  await recalculatePaymentAllocationStatus(workspace.organization.id, id);
  revalidatePath(`/facturation/paiements/${id}`);
  redirect(`/facturation/paiements/${id}`);
}

export async function allocatePaymentToInvoices(prev: PaymentActionResult, formData: FormData): Promise<PaymentActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const paymentId = text(formData, "payment_id");
  if (!paymentId) return { success: false, error: "Paiement introuvable." };
  const allocations = parseAllocations(formData);
  if (allocations.length === 0) return { success: false, error: "Saisissez au moins une affectation." };
  const supabase = await createClient();
  const { data: payment, error } = await supabase
    .from("customer_payments")
    .select("id, third_party_id, available_amount, status")
    .eq("organization_id", workspace.organization.id)
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !payment) return { success: false, error: "Paiement introuvable." };
  if (payment.status === "cancelled") return { success: false, error: "Impossible d'affecter un paiement annule." };
  const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (total > Number(payment.available_amount ?? 0)) return { success: false, error: "Le montant affecte depasse le disponible." };
  const result = await createAllocationRows(workspace.organization.id, workspace.userId, paymentId, payment.third_party_id as string, allocations);
  if (result.error) return { success: false, error: result.error };
  revalidatePath(`/facturation/paiements/${paymentId}`);
  revalidatePath("/facturation/factures");
  redirect(`/facturation/paiements/${paymentId}`);
}

export async function unallocatePaymentFromInvoice(prev: PaymentActionResult, formData: FormData): Promise<PaymentActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const allocationId = text(formData, "allocation_id");
  if (!allocationId) return { success: false, error: "Affectation introuvable." };
  const supabase = await createClient();
  const { data: allocation, error: fetchError } = await supabase
    .from("customer_payment_allocations")
    .select("id, payment_id, invoice_id")
    .eq("organization_id", workspace.organization.id)
    .eq("id", allocationId)
    .maybeSingle();
  if (fetchError || !allocation) return { success: false, error: "Affectation introuvable." };
  const { error } = await supabase
    .from("customer_payment_allocations")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("organization_id", workspace.organization.id)
    .eq("id", allocationId);
  if (error) return { success: false, error: error.message };
  await recalculateInvoicePaymentStatus(workspace.organization.id, allocation.invoice_id as string);
  await recalculatePaymentAllocationStatus(workspace.organization.id, allocation.payment_id as string);
  revalidatePath(`/facturation/paiements/${allocation.payment_id}`);
  return { success: true };
}

export const allocateInvoiceFromPayment = allocatePaymentToInvoices;
export const createPaymentAndAllocateToInvoice = createCustomerPayment;

export async function cancelCustomerPayment(prev: PaymentActionResult, formData: FormData): Promise<PaymentActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Paiement introuvable." };
  const supabase = await createClient();
  const { data: allocations } = await supabase
    .from("customer_payment_allocations")
    .select("invoice_id")
    .eq("organization_id", workspace.organization.id)
    .eq("payment_id", id)
    .is("cancelled_at", null);
  const { error } = await supabase
    .from("customer_payments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), allocated_amount: 0, available_amount: 0 })
    .eq("organization_id", workspace.organization.id)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  await supabase.from("customer_payment_allocations").update({ cancelled_at: new Date().toISOString() }).eq("organization_id", workspace.organization.id).eq("payment_id", id);
  for (const allocation of allocations ?? []) await recalculateInvoicePaymentStatus(workspace.organization.id, allocation.invoice_id as string);
  revalidatePath(`/facturation/paiements/${id}`);
  return { success: true };
}

export async function confirmCustomerPayment(prev: PaymentActionResult, formData: FormData): Promise<PaymentActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Paiement introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_payments").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/facturation/paiements/${id}`);
  return { success: true };
}

export async function archiveCustomerPayment(prev: PaymentActionResult, formData: FormData): Promise<PaymentActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Paiement introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_payments").update({ archived_at: new Date().toISOString() }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/facturation/paiements");
  redirect("/facturation/paiements");
}
