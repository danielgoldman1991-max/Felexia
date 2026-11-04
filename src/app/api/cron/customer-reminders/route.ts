import { NextRequest, NextResponse } from "next/server";
import { collectionQueue, type CollectionInvoice, type CollectionRule } from "@/lib/sales/collection";
import { sendTransactionalEmail } from "@/lib/mail/outbound";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Service temporairement indisponible" }, { status: 503, headers: NO_STORE });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401, headers: NO_STORE });
  }
  try {
    const { createClient } = await import("@/lib/supabase/service");
    const supabase = createClient();
    const settings = await supabase.from("customer_collection_settings").select("organization_id, include_arabic").eq("auto_send", true);
    if (settings.error) return NextResponse.json({ generated: 0, pending: true }, { headers: NO_STORE });
    const today = new Date().toISOString().slice(0, 10);
    let generated = 0;
    for (const row of settings.data ?? []) {
      const organizationId = row.organization_id as string;
      const plan = await supabase.from("organization_subscriptions").select("plan_code").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (plan.data?.plan_code !== "premium" && plan.data?.plan_code !== "pro") continue;
      const prepared = await prepareOrganization(supabase, organizationId, today, row.include_arabic === true);
      generated += prepared;
    }
    return NextResponse.json({ generated }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Les relances automatiques n'ont pas abouti.", generated: 0 }, { status: 503, headers: NO_STORE });
  }
}

async function prepareOrganization(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/service").createClient>>, organizationId: string, today: string, arabic: boolean) {
  const [invoices, rules, reminders] = await Promise.all([
    supabase.from("customer_invoices").select("id, invoice_number, customer_id, customer_name, due_date, remaining_amount, total_ttc").eq("organization_id", organizationId).gt("remaining_amount", 0).not("status", "in", "(draft,cancelled)").is("archived_at", null).limit(200),
    supabase.from("customer_reminder_rules").select("id, name, days_after_due, level, channel, subject, message, active").eq("organization_id", organizationId).eq("active", true).eq("channel", "email"),
    supabase.from("customer_reminders").select("id, reminder_level").eq("organization_id", organizationId).neq("status", "cancelled").limit(200),
  ]);
  const reminderIds = (reminders.data ?? []).map((item) => item.id as string);
  const links = reminderIds.length
    ? await supabase.from("customer_reminder_invoices").select("invoice_id, reminder_id").eq("organization_id", organizationId).in("reminder_id", reminderIds)
    : { data: [] };
  const levels = new Map((reminders.data ?? []).map((item) => [item.id as string, Number(item.reminder_level)]));
  const open: CollectionInvoice[] = (invoices.data ?? []).map((invoice) => ({
    id: invoice.id as string,
    number: invoice.invoice_number as string,
    customerId: invoice.customer_id as string,
    customerName: (invoice.customer_name as string | null) || "Client",
    dueDate: invoice.due_date as string,
    remaining: Number(invoice.remaining_amount ?? 0),
    total: Number(invoice.total_ttc ?? 0),
  }));
  const typedRules: CollectionRule[] = (rules.data ?? []).map((rule) => ({
    id: rule.id as string,
    name: rule.name as string | null,
    daysAfterDue: Number(rule.days_after_due),
    level: Number(rule.level),
    channel: "email",
    subject: rule.subject as string | null,
    message: rule.message as string | null,
    active: true,
  }));
  const queue = collectionQueue({
    invoices: open,
    rules: typedRules,
    today,
    arabic,
    sent: (links.data ?? []).map((link) => ({ invoiceId: link.invoice_id as string, level: levels.get(link.reminder_id as string) ?? 1 })),
  });
  let created = 0;
  for (const item of queue) {
    const customer = await supabase.from("third_parties").select("email").eq("id", item.invoice.customerId).maybeSingle();
    const email = customer.data?.email as string | null;
    if (!email) continue;
    const sent = await sendTransactionalEmail({ to: email, subject: item.subject, text: item.message });
    if (!sent.delivered) {
      await supabase.from("customer_reminder_dispatches").insert({
        organization_id: organizationId,
        invoice_id: item.invoice.id,
        customer_id: item.invoice.customerId,
        channel: "email",
        status: sent.transport === "unconfigured" ? "skipped" : "failed",
        recipient: email,
        subject: item.subject,
        body: item.message,
        error: sent.error ?? "Expéditeur non configuré",
      });
      continue;
    }
    const reminder = await supabase.from("customer_reminders").insert({
      organization_id: organizationId,
      reminder_number: "",
      customer_id: item.invoice.customerId,
      reminder_level: item.rule.level,
      channel: "email",
      status: "sent",
      sent_at: new Date().toISOString(),
      reminder_date: today,
      due_date: item.invoice.dueDate,
      total_due_amount: item.invoice.remaining,
      total_overdue_amount: item.daysOverdue > 0 ? item.invoice.remaining : 0,
      subject: item.subject,
      message: item.message,
    }).select("id").single();
    if (reminder.data?.id) {
      await supabase.from("customer_reminder_invoices").insert({
        organization_id: organizationId,
        reminder_id: reminder.data.id,
        invoice_id: item.invoice.id,
        invoice_number: item.invoice.number,
        due_date: item.invoice.dueDate,
        total_ttc: item.invoice.total,
        remaining_amount: item.invoice.remaining,
        paid_amount: 0,
        days_overdue: item.daysOverdue,
      });
      created += 1;
    }
  }
  return created;
}
