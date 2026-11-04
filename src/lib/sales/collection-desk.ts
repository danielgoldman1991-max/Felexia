import { requireActiveWorkspace } from "@/lib/auth";
import { isMissingSchema } from "@/lib/optional-schema";
import { createClient } from "@/lib/supabase/server";
import { collectionQueue, embeddedCustomerField, embeddedCustomerName, type CollectionInvoice, type CollectionRule } from "@/lib/sales/collection";

export async function loadCollectionDesk(today = new Date().toISOString().slice(0, 10)) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const orgId = workspace.organization.id;
  const [invoices, rules, reminders, exclusions, promises, settings, account] = await Promise.all([
    supabase.from("customer_invoices").select("id, invoice_number, customer_id, due_date, invoice_date, remaining_amount, total_ttc, customer:customer_id(name, email, phone, mobile)").eq("organization_id", orgId).gt("remaining_amount", 0).not("status", "in", "(draft,cancelled)").is("archived_at", null).not("due_date", "is", null).limit(400),
    supabase.from("customer_reminder_rules").select("id, name, days_after_due, level, channel, subject, message, active").eq("organization_id", orgId).eq("active", true),
    supabase.from("customer_reminders").select("id, customer_id, reminder_level, status").eq("organization_id", orgId).neq("status", "cancelled").is("archived_at", null).limit(500),
    supabase.from("customer_collection_exclusions").select("customer_id, paused_until, reason").eq("organization_id", orgId),
    supabase.from("customer_payment_promises").select("id, customer_id, invoice_id, promised_on, amount, status").eq("organization_id", orgId).eq("status", "open"),
    supabase.from("customer_collection_settings").select("auto_send, include_arabic").eq("organization_id", orgId).maybeSingle(),
    supabase.from("treasury_accounts").select("rib, iban").eq("organization_id", orgId).eq("status", "active").is("archived_at", null).order("is_default", { ascending: false }).limit(1),
  ]);
  const pending = [exclusions.error, promises.error, settings.error].some((error) => isMissingSchema(error));
  const reminderIds = (reminders.data ?? []).map((row) => row.id as string);
  const links = reminderIds.length
    ? await supabase.from("customer_reminder_invoices").select("invoice_id, reminder_id").eq("organization_id", orgId).in("reminder_id", reminderIds.slice(0, 200))
    : { data: [] };
  const levelByReminder = new Map((reminders.data ?? []).map((row) => [row.id as string, Number(row.reminder_level ?? 1)]));
  const openInvoices: CollectionInvoice[] = (invoices.data ?? []).map((row) => ({
    id: row.id as string,
    number: row.invoice_number as string,
    customerId: row.customer_id as string,
    customerName: embeddedCustomerName(row.customer),
    dueDate: row.due_date as string,
    invoiceDate: row.invoice_date as string | null,
    remaining: Number(row.remaining_amount ?? 0),
    total: Number(row.total_ttc ?? 0),
    email: embeddedCustomerField(row.customer, "email"),
    phone: embeddedCustomerField(row.customer, "mobile") || embeddedCustomerField(row.customer, "phone"),
  }));
  const typedRules: CollectionRule[] = (rules.error ? [] : rules.data ?? []).map((rule) => ({
    id: rule.id as string,
    name: (rule.name as string | null) ?? null,
    daysAfterDue: Number(rule.days_after_due ?? 0),
    level: Number(rule.level ?? 1),
    channel: (rule.channel as string | null) ?? "email",
    subject: (rule.subject as string | null) ?? null,
    message: (rule.message as string | null) ?? null,
    active: rule.active !== false,
  }));
  const rib = ((account.data?.[0]?.rib as string | null) || (account.data?.[0]?.iban as string | null) || null);
  const queue = collectionQueue({
    invoices: openInvoices,
    rules: typedRules,
    today,
    sent: (links.data ?? []).map((link) => ({ invoiceId: link.invoice_id as string, level: levelByReminder.get(link.reminder_id as string) ?? 1 })),
    exclusions: exclusions.error ? [] : (exclusions.data ?? []).map((row) => ({ customerId: row.customer_id as string, until: (row.paused_until as string | null) ?? null })),
    promises: promises.error ? [] : (promises.data ?? []).map((row) => ({ customerId: row.customer_id as string, invoiceId: (row.invoice_id as string | null) ?? null, promisedOn: row.promised_on as string })),
    rib,
    arabic: settings.data?.include_arabic === true,
  });
  return {
    pending,
    today,
    queue,
    openInvoices,
    autoSend: settings.data?.auto_send === true,
    arabic: settings.data?.include_arabic === true,
    rib,
    promises: promises.error ? [] : promises.data ?? [],
    exclusions: exclusions.error ? [] : exclusions.data ?? [],
  };
}
