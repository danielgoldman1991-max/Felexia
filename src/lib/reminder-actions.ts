"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth";
import { listOverdueInvoicesByCustomer } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";
import type { ReminderActionResult } from "@/lib/reminder-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value === "" ? null : value;
}

function parseIds(formData: FormData, key: string) {
  try {
    const parsed = JSON.parse(String(formData.get(key) ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  } catch {
    return [];
  }
}

export async function createCustomerReminder(prev: ReminderActionResult, formData: FormData): Promise<ReminderActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const customerId = text(formData, "customer_id");
  const invoiceIds = parseIds(formData, "invoice_ids");
  if (!customerId) return { success: false, error: "Selectionnez un client." };
  if (invoiceIds.length === 0) return { success: false, error: "Selectionnez au moins une facture a relancer." };

  const invoices = (await listOverdueInvoicesByCustomer(customerId)).filter((invoice) => invoiceIds.includes(invoice.id));
  if (invoices.length !== invoiceIds.length) return { success: false, error: "Certaines factures ne sont plus relancables." };

  const supabase = await createClient();
  const totalDue = invoices.reduce((sum, invoice) => sum + invoice.remaining_amount, 0);
  const { data, error } = await supabase
    .from("customer_reminders")
    .insert({
      organization_id: workspace.organization.id,
      reminder_number: "",
      customer_id: customerId,
      reminder_level: Number(formData.get("reminder_level") ?? 1),
      channel: text(formData, "channel"),
      reminder_date: text(formData, "reminder_date") ?? new Date().toISOString().split("T")[0],
      due_date: text(formData, "due_date"),
      total_due_amount: totalDue,
      total_overdue_amount: totalDue,
      subject: text(formData, "subject"),
      message: text(formData, "message"),
      internal_notes: text(formData, "internal_notes"),
      created_by: workspace.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { success: false, error: error?.message ?? "Impossible de creer la relance." };

  const { error: lineError } = await supabase.from("customer_reminder_invoices").insert(
    invoices.map((invoice) => ({
      organization_id: workspace.organization.id,
      reminder_id: data.id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      total_ttc: invoice.total_ttc,
      paid_amount: invoice.paid_amount,
      remaining_amount: invoice.remaining_amount,
      days_overdue: invoice.days_overdue,
    })),
  );
  if (lineError) return { success: false, error: lineError.message };

  revalidatePath("/facturation/relances");
  redirect(`/facturation/relances/${data.id}`);
}

async function updateReminderStatus(formData: FormData, status: "sent" | "cancelled") {
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Relance introuvable." };
  const payload: Record<string, unknown> = { status };
  if (status === "sent") payload.sent_at = new Date().toISOString();
  if (status === "cancelled") payload.cancelled_at = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("customer_reminders").update(payload).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath(`/facturation/relances/${id}`);
  return { success: true };
}

export async function markReminderAsSent(prev: ReminderActionResult, formData: FormData) {
  void prev;
  return updateReminderStatus(formData, "sent");
}

export async function cancelCustomerReminder(prev: ReminderActionResult, formData: FormData) {
  void prev;
  return updateReminderStatus(formData, "cancelled");
}

export async function archiveCustomerReminder(prev: ReminderActionResult, formData: FormData): Promise<ReminderActionResult> {
  void prev;
  const workspace = await requireActiveWorkspace();
  const id = text(formData, "id");
  if (!id) return { success: false, error: "Relance introuvable." };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_reminders").update({ archived_at: new Date().toISOString() }).eq("organization_id", workspace.organization.id).eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/facturation/relances");
  redirect("/facturation/relances");
}
