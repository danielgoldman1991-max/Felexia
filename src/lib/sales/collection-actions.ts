"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProWorkspace } from "@/lib/pro-access";
import { isMissingSchema, SCHEMA_PENDING_MESSAGE } from "@/lib/optional-schema";
import { sendTransactionalEmail } from "@/lib/mail/outbound";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COLLECTION_SCENARIOS } from "@/lib/sales/collection";
import { loadCollectionDesk } from "@/lib/sales/collection-desk";
import type { ReminderActionResult } from "@/lib/reminder-types";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function isRedirectError(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

export async function approveCollectionItem(prev: ReminderActionResult, formData: FormData): Promise<ReminderActionResult> {
  void prev;
  const invoiceId = text(formData, "invoice_id");
  if (!invoiceId) return { success: false, error: "Facture introuvable." };
  try {
    const workspace = await requireProWorkspace();
    const desk = await loadCollectionDesk();
    const item = desk.queue.find((entry) => entry.invoice.id === invoiceId);
    if (!item) return { success: false, error: "Cette facture n'est plus à relancer." };
    const supabase = await createClient();
    const channel = item.rule.channel || "email";
    const created = await supabase.from("customer_reminders").insert({
      organization_id: workspace.organization.id,
      reminder_number: "",
      customer_id: item.invoice.customerId,
      reminder_level: item.rule.level,
      channel,
      reminder_date: desk.today,
      due_date: item.invoice.dueDate,
      total_due_amount: item.invoice.remaining,
      total_overdue_amount: item.daysOverdue > 0 ? item.invoice.remaining : 0,
      subject: item.subject,
      message: item.message,
      created_by: workspace.userId,
    }).select("id").single();
    if (created.error || !created.data) return { success: false, error: created.error?.message ?? "La relance n'a pas été créée." };
    await supabase.from("customer_reminder_invoices").insert({
      organization_id: workspace.organization.id,
      reminder_id: created.data.id,
      invoice_id: item.invoice.id,
      invoice_number: item.invoice.number,
      invoice_date: item.invoice.invoiceDate,
      due_date: item.invoice.dueDate,
      total_ttc: item.invoice.total,
      paid_amount: Math.max(item.invoice.total - item.invoice.remaining, 0),
      remaining_amount: item.invoice.remaining,
      days_overdue: item.daysOverdue,
    });
    let status = "journal";
    let error: string | null = "Aucun expéditeur transactionnel n'est configuré. Le message est conservé dans le journal.";
    if (channel === "email" && item.invoice.email) {
      const sent = await sendTransactionalEmail({ to: item.invoice.email, subject: item.subject, text: item.message });
      status = sent.delivered ? "sent" : sent.transport === "unconfigured" ? "journal" : "failed";
      error = sent.delivered ? null : sent.error ?? error;
      if (sent.delivered) {
        await supabase.from("customer_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", created.data.id);
      }
    }
    if (channel === "whatsapp" || channel === "letter") {
      status = "journal";
      error = channel === "whatsapp" ? "Ouverture manuelle de WhatsApp." : "Courrier à imprimer.";
    }
    const dispatch = await supabase.from("customer_reminder_dispatches").insert({
      organization_id: workspace.organization.id,
      reminder_id: created.data.id,
      invoice_id: item.invoice.id,
      customer_id: item.invoice.customerId,
      channel,
      status,
      recipient: item.invoice.email || item.invoice.phone,
      subject: item.subject,
      body: item.message,
      error,
    });
    if (dispatch.error && !isMissingSchema(dispatch.error)) return { success: false, error: dispatch.error.message };
    revalidatePath("/facturation/relances");
    revalidatePath("/facturation/relances/file");
    if (channel === "letter") redirect(`/facturation/relances/${created.data.id}/print`);
    return { success: true, data: { id: created.data.id, message: status === "sent" ? "E-mail remis au service d'envoi." : "Relance préparée. L'envoi e-mail reste à faire si aucun expéditeur n'est configuré." } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return { success: false, error: error instanceof Error ? error.message : "La relance n'a pas été préparée." };
  }
}

export async function saveCollectionSettings(prev: ReminderActionResult, formData: FormData): Promise<ReminderActionResult> {
  void prev;
  try {
    const workspace = await requireProWorkspace();
    const supabase = await createClient();
    const saved = await supabase.from("customer_collection_settings").upsert({
      organization_id: workspace.organization.id,
      auto_send: formData.get("auto_send") === "on",
      include_arabic: formData.get("include_arabic") === "on",
      updated_at: new Date().toISOString(),
    });
    if (isMissingSchema(saved.error)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
    if (saved.error) return { success: false, error: saved.error.message };
    revalidatePath("/facturation/relances/file");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Le réglage n'a pas été enregistré." };
  }
}

export async function saveCollectionExclusion(prev: ReminderActionResult, formData: FormData): Promise<ReminderActionResult> {
  void prev;
  const customerId = text(formData, "customer_id");
  if (!customerId) return { success: false, error: "Choisissez un client." };
  try {
    const workspace = await requireProWorkspace();
    const supabase = await createClient();
    const saved = await supabase.from("customer_collection_exclusions").upsert({
      organization_id: workspace.organization.id,
      customer_id: customerId,
      reason: text(formData, "reason") === "dispute" ? "dispute" : "pause",
      paused_until: text(formData, "paused_until"),
      note: text(formData, "note"),
    }, { onConflict: "organization_id,customer_id" });
    if (isMissingSchema(saved.error)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
    if (saved.error) return { success: false, error: saved.error.message };
    revalidatePath("/facturation/relances/file");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "L'exclusion n'a pas été enregistrée." };
  }
}

export async function savePaymentPromise(prev: ReminderActionResult, formData: FormData): Promise<ReminderActionResult> {
  void prev;
  const customerId = text(formData, "customer_id");
  const promisedOn = text(formData, "promised_on");
  const amount = Number(formData.get("amount") ?? 0);
  if (!customerId || !promisedOn || !(amount > 0)) return { success: false, error: "Client, date et montant sont requis." };
  try {
    const workspace = await requireProWorkspace();
    const supabase = await createClient();
    const saved = await supabase.from("customer_payment_promises").insert({
      organization_id: workspace.organization.id,
      customer_id: customerId,
      invoice_id: text(formData, "invoice_id"),
      promised_on: promisedOn,
      amount,
      note: text(formData, "note"),
      status: "open",
    });
    if (isMissingSchema(saved.error)) return { success: false, error: SCHEMA_PENDING_MESSAGE };
    if (saved.error) return { success: false, error: saved.error.message };
    revalidatePath("/facturation/relances/file");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "La promesse n'a pas été enregistrée." };
  }
}

export async function seedCollectionScenarios() {
  const workspace = await requireProWorkspace();
  const supabase = await createClient();
  const existing = await supabase.from("customer_reminder_rules").select("id").eq("organization_id", workspace.organization.id).limit(1);
  if (existing.error) return;
  if ((existing.data ?? []).length > 0) redirect("/facturation/relances/regles");
  await supabase.from("customer_reminder_rules").insert(DEFAULT_COLLECTION_SCENARIOS.map((scenario) => ({
    organization_id: workspace.organization.id,
    name: scenario.name,
    days_after_due: scenario.daysAfterDue,
    level: scenario.level,
    channel: scenario.channel,
    subject: scenario.subject,
    message: scenario.message,
    active: true,
  })));
  revalidatePath("/facturation/relances/regles");
  redirect("/facturation/relances/regles");
}
