import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerReminderForm } from "@/components/reminders/customer-reminder-form";
import { getReminderPreparation } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { matchingReminderRule } from "@/lib/sales/reminder-schedule";
import { isMissingSchema } from "@/lib/optional-schema";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ customerId?: string }>;

export default async function NewCustomerReminderPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const customerId = params.customerId ?? "";
  const { customers, invoices, suggestedLevel } = await getReminderPreparation(customerId);
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const rules = await supabase.from("customer_reminder_rules").select("id, days_after_due, level, active, subject, message").eq("organization_id", workspace.organization.id).eq("active", true);
  const daysOverdue = invoices.reduce((max, invoice) => Math.max(max, invoice.days_overdue ?? 0), 0);
  const rule = isMissingSchema(rules.error) ? null : matchingReminderRule((rules.data ?? []).map((row) => ({
    id: row.id as string,
    daysAfterDue: Number(row.days_after_due ?? 0),
    level: Number(row.level ?? 1),
    active: row.active !== false,
    subject: row.subject as string | null,
    message: row.message as string | null,
  })), daysOverdue);
  return (
    <ModulePage>
      <PageHeader title="Nouvelle relance" description="Sélectionnez un client, ses factures échues puis le niveau de relance." />
      <CustomerReminderForm
        key={`${customerId}:${invoices.map((invoice) => invoice.id).join(",")}:${rule?.id ?? ""}`}
        customers={customers}
        invoices={invoices}
        initialCustomerId={customerId}
        suggestedLevel={rule?.level ?? suggestedLevel}
        initialSubject={rule?.subject ?? undefined}
        initialMessage={rule?.message ?? undefined}
      />
    </ModulePage>
  );
}
