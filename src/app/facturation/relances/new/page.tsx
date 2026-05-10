import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerReminderForm } from "@/components/reminders/customer-reminder-form";
import { getReminderPreparation } from "@/lib/reminders";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ customerId?: string }>;

export default async function NewCustomerReminderPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const customerId = params.customerId ?? "";
  const { customers, invoices, suggestedLevel } = await getReminderPreparation(customerId);
  return (
    <ModulePage>
      <PageHeader title="Nouvelle relance" description="Selectionnez un client, ses factures echues puis le niveau de relance." />
      <CustomerReminderForm customers={customers} invoices={invoices} initialCustomerId={customerId} suggestedLevel={suggestedLevel} />
    </ModulePage>
  );
}
