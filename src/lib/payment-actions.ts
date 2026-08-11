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

export async function createCustomerPayment(prev: PaymentActionResult, formData: FormData): Promise<PaymentActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const thirdPartyId = text(formData, "third_party_id") ?? text(formData, "customer_id");
  const amount = numberValue(formData.get("amount"));
  const paymentMethod = text(formData, "payment_method");
  const treasuryAccountId = text(formData, "treasury_account_id");
  if (!thirdPartyId) return { success: false, error: "Selectionnez un client." };
  if (amount <= 0) return { success: false, error: "Le montant doit etre superieur a zero." };
  if (!paymentMethod) return { success: false, error: "Selectionnez une modalite de paiement." };
  if (!treasuryAccountId) return { success: false, error: "Selectionnez un compte d encaissement." };
  const thirdPartyValidation = await validateThirdParty(workspace.organization.id, thirdPartyId);
  if (thirdPartyValidation.error) return { success: false, error: thirdPartyValidation.error };

  const allocations = parseAllocations(formData);
  const allocatedTotal = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (allocatedTotal > amount) return { success: false, error: "Le montant affecte depasse le paiement disponible." };
  const validation = await validateAllocationTargets(workspace.organization.id, thirdPartyId, allocations);
  if (validation.error) return { success: false, error: validation.error };

  const supabase = await createClient();
  const atomicResult = await supabase.rpc("create_customer_payment_atomic", {
    p_organization_id: workspace.organization.id,
    p_third_party_id: thirdPartyId,
    p_treasury_account_id: treasuryAccountId,
    p_amount: amount,
    p_payment_date: text(formData, "payment_date") ?? new Date().toISOString().split("T")[0],
    p_idempotency_key: text(formData, "idempotency_key") ?? globalThis.crypto.randomUUID(),
    p_allocations: allocations,
    p_value_date: text(formData, "value_date"),
    p_payment_method: paymentMethod,
    p_payment_type: text(formData, "payment_type") ?? "customer_payment",
    p_source_type: text(formData, "source_type") ?? "manual",
    p_source_invoice_id: text(formData, "source_invoice_id"),
    p_reference: text(formData, "reference"),
    p_bank_name: text(formData, "bank_name"),
    p_check_number: text(formData, "check_number"),
    p_transfer_reference: text(formData, "transfer_reference"),
    p_due_date: text(formData, "due_date"),
    p_notes: text(formData, "notes"),
    p_internal_notes: text(formData, "internal_notes"),
    p_created_by: workspace.userId,
  });
  if (atomicResult.error) {
    console.error("[payments] atomic customer payment failed", {
      code: atomicResult.error.code,
    });
    return {
      success: false,
      error: ["PGRST202", "42883"].includes(atomicResult.error.code ?? "")
        ? "La mise à niveau d'intégrité de la base doit être appliquée avant de créer un paiement client."
        : "Le paiement a été refusé afin de préserver la facture et la trésorerie.",
    };
  }
  const atomicPayment = Array.isArray(atomicResult.data) ? atomicResult.data[0] : atomicResult.data;
  const paymentId = atomicPayment && typeof atomicPayment === "object" && "payment_id" in atomicPayment
    ? String(atomicPayment.payment_id)
    : null;
  if (!paymentId) return { success: false, error: "Le paiement transactionnel n'a pas retourné d'identifiant." };
  revalidatePath("/facturation/paiements");
  revalidatePath("/facturation/factures");
  redirect(`/facturation/paiements/${paymentId}`);
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
  const result = await supabase.rpc("update_customer_payment_atomic", {
    p_organization_id: workspace.organization.id,
    p_payment_id: id,
    p_amount: amount,
    p_payment_date: text(formData, "payment_date") ?? new Date().toISOString().split("T")[0],
    p_value_date: text(formData, "value_date"),
    p_payment_method: text(formData, "payment_method") ?? "bank_transfer",
    p_payment_type: text(formData, "payment_type") ?? "customer_payment",
    p_reference: text(formData, "reference"),
    p_bank_name: text(formData, "bank_name"),
    p_check_number: text(formData, "check_number"),
    p_transfer_reference: text(formData, "transfer_reference"),
    p_due_date: text(formData, "due_date"),
    p_notes: text(formData, "notes"),
    p_internal_notes: text(formData, "internal_notes"),
  });
  if (result.error) {
    console.error("[payments] atomic customer payment update failed", {
      code: result.error.code,
    });
    return {
      success: false,
      error: ["PGRST202", "42883"].includes(result.error.code ?? "")
        ? "La mise à niveau d'intégrité de la base doit être appliquée avant de modifier ce paiement."
        : "La modification a été refusée afin de préserver la trésorerie.",
    };
  }
  revalidatePath(`/facturation/paiements/${id}`);
  revalidatePath("/tresorerie");
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
  const result = await supabase.rpc("allocate_customer_payment_atomic", {
    p_organization_id: workspace.organization.id,
    p_payment_id: paymentId,
    p_allocations: allocations,
    p_created_by: workspace.userId,
  });
  if (result.error) {
    console.error("[payments] atomic customer allocation failed", {
      code: result.error.code,
    });
    return {
      success: false,
      error: ["PGRST202", "42883"].includes(result.error.code ?? "")
        ? "La mise à niveau d'intégrité de la base doit être appliquée avant d'affecter ce paiement."
        : "L'affectation a été refusée afin de préserver les soldes client.",
    };
  }
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
  const result = await supabase.rpc("unallocate_customer_payment_atomic", {
    p_organization_id: workspace.organization.id,
    p_allocation_id: allocationId,
  });
  if (result.error) {
    console.error("[payments] atomic customer unallocation failed", {
      code: result.error.code,
    });
    return {
      success: false,
      error: ["PGRST202", "42883"].includes(result.error.code ?? "")
        ? "La mise à niveau d'intégrité de la base doit être appliquée avant de retirer cette affectation."
        : "Le retrait a été refusé afin de préserver les soldes client.",
    };
  }
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
  const cancelResult = await supabase.rpc("cancel_customer_payment_atomic", {
    p_organization_id: workspace.organization.id,
    p_payment_id: id,
  });
  if (cancelResult.error) {
    console.error("[payments] atomic customer payment cancellation failed", {
      code: cancelResult.error.code,
    });
    return {
      success: false,
      error: ["PGRST202", "42883"].includes(cancelResult.error.code ?? "")
        ? "La mise à niveau d'intégrité de la base doit être appliquée avant d'annuler un paiement client."
        : "L'annulation a été refusée afin de préserver la facture et la trésorerie.",
    };
  }
  revalidatePath(`/facturation/paiements/${id}`);
  revalidatePath("/facturation/factures");
  revalidatePath("/tresorerie");
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
