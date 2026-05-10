import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  CustomerReminderDetail,
  CustomerReminderInvoiceRecord,
  CustomerReminderRecord,
  OverdueInvoiceForReminder,
  ReminderCounters,
  ReminderCustomerOption,
} from "@/lib/reminder-types";

const REMINDER_SELECT = `
  id, organization_id, reminder_number, customer_id, reminder_level, status, channel,
  reminder_date, due_date, sent_at, cancelled_at, total_due_amount, total_overdue_amount,
  subject, message, internal_notes, created_at, archived_at,
  customer:customer_id(name)
`;

const REMINDER_INVOICE_SELECT = `
  id, reminder_id, invoice_id, invoice_number, invoice_date, due_date, total_ttc,
  paid_amount, remaining_amount, days_overdue
`;

function objectValue(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function activeOrganizationId() {
  const workspace = await requireActiveWorkspace();
  return workspace.organization.id;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function daysOverdue(dueDate: string | null) {
  if (!dueDate) return 0;
  const diff = new Date(todayIso()).getTime() - new Date(dueDate).getTime();
  return Math.max(Math.floor(diff / 86400000), 0);
}

function mapReminder(row: Record<string, unknown>): CustomerReminderRecord {
  const customer = objectValue(row.customer);
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    reminder_number: row.reminder_number as string,
    customer_id: row.customer_id as string,
    customer_name: customer?.name as string | null,
    reminder_level: Number(row.reminder_level ?? 1),
    status: row.status as CustomerReminderRecord["status"],
    channel: row.channel as CustomerReminderRecord["channel"],
    reminder_date: row.reminder_date as string,
    due_date: row.due_date as string | null,
    total_due_amount: Number(row.total_due_amount ?? 0),
    total_overdue_amount: Number(row.total_overdue_amount ?? 0),
    subject: row.subject as string | null,
    message: row.message as string | null,
    internal_notes: row.internal_notes as string | null,
    sent_at: row.sent_at as string | null,
    cancelled_at: row.cancelled_at as string | null,
    created_at: row.created_at as string,
    archived_at: row.archived_at as string | null,
  };
}

function mapReminderInvoice(row: Record<string, unknown>): CustomerReminderInvoiceRecord {
  return {
    id: row.id as string,
    reminder_id: row.reminder_id as string,
    invoice_id: row.invoice_id as string,
    invoice_number: row.invoice_number as string | null,
    invoice_date: row.invoice_date as string | null,
    due_date: row.due_date as string | null,
    total_ttc: Number(row.total_ttc ?? 0),
    paid_amount: Number(row.paid_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? 0),
    days_overdue: row.days_overdue === null ? null : Number(row.days_overdue ?? 0),
  };
}

export async function listOverdueInvoicesByCustomer(customerId: string): Promise<OverdueInvoiceForReminder[]> {
  if (!customerId) return [];
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_invoices")
    .select("id, invoice_number, customer_id, invoice_date, due_date, total_ttc, paid_amount, remaining_amount, payment_status, status")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .gt("remaining_amount", 0)
    .lt("due_date", todayIso())
    .in("payment_status", ["unpaid", "partial"])
    .not("status", "in", "(cancelled,draft)")
    .is("archived_at", null)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    invoice_number: row.invoice_number as string,
    customer_id: row.customer_id as string,
    invoice_date: row.invoice_date as string,
    due_date: row.due_date as string | null,
    total_ttc: Number(row.total_ttc ?? 0),
    paid_amount: Number(row.paid_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? 0),
    payment_status: row.payment_status as string,
    status: row.status as string,
    days_overdue: daysOverdue(row.due_date as string | null),
  }));
}

export async function listCustomersWithOverdueInvoices(): Promise<ReminderCustomerOption[]> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_invoices")
    .select("customer_id, remaining_amount, customer:customer_id(name, commercial_name)")
    .eq("organization_id", organizationId)
    .gt("remaining_amount", 0)
    .lt("due_date", todayIso())
    .in("payment_status", ["unpaid", "partial"])
    .not("status", "in", "(cancelled,draft)")
    .is("archived_at", null);
  if (error) throw new Error(error.message);

  const byCustomer = new Map<string, ReminderCustomerOption>();
  for (const row of data ?? []) {
    const customer = objectValue((row as Record<string, unknown>).customer);
    const id = row.customer_id as string;
    const current = byCustomer.get(id) ?? {
      id,
      name: (customer?.name as string | null) ?? "Client",
      commercial_name: customer?.commercial_name as string | null,
      total_remaining_amount: 0,
      overdue_invoices_count: 0,
    };
    current.total_remaining_amount += Number(row.remaining_amount ?? 0);
    current.overdue_invoices_count += 1;
    byCustomer.set(id, current);
  }
  return Array.from(byCustomer.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCustomerReminders() {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_reminders")
    .select(REMINDER_SELECT)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapReminder(row as Record<string, unknown>));
}

export async function getCustomerReminderDetail(id: string): Promise<CustomerReminderDetail> {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const [reminderResult, invoicesResult] = await Promise.all([
    supabase.from("customer_reminders").select(REMINDER_SELECT).eq("organization_id", organizationId).eq("id", id).maybeSingle(),
    supabase.from("customer_reminder_invoices").select(REMINDER_INVOICE_SELECT).eq("organization_id", organizationId).eq("reminder_id", id).order("created_at"),
  ]);
  if (reminderResult.error) throw new Error(reminderResult.error.message);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);
  return {
    reminder: reminderResult.data ? mapReminder(reminderResult.data as Record<string, unknown>) : null,
    invoices: (invoicesResult.data ?? []).map((row) => mapReminderInvoice(row as Record<string, unknown>)),
  };
}

export async function getSuggestedReminderLevel(customerId: string) {
  const organizationId = await activeOrganizationId();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("customer_reminders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  return Math.min((count ?? 0) + 1, 3);
}

export async function getReminderPreparation(customerId: string) {
  const [customers, invoices, suggestedLevel] = await Promise.all([
    listCustomersWithOverdueInvoices(),
    listOverdueInvoicesByCustomer(customerId),
    customerId ? getSuggestedReminderLevel(customerId) : Promise.resolve(1),
  ]);
  return { customers, invoices, suggestedLevel };
}

export async function getReminderCounters(): Promise<ReminderCounters> {
  const [customers, reminders] = await Promise.all([listCustomersWithOverdueInvoices(), listCustomerReminders()]);
  return {
    overdueInvoices: customers.reduce((sum, customer) => sum + customer.overdue_invoices_count, 0),
    overdueAmount: customers.reduce((sum, customer) => sum + customer.total_remaining_amount, 0),
    draft: reminders.filter((reminder) => reminder.status === "draft").length,
    sent: reminders.filter((reminder) => reminder.status === "sent").length,
  };
}
