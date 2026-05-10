import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { CustomerReminderDetail } from "@/components/reminders/customer-reminder-detail";
import { getCustomerReminderDetail } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export default async function CustomerReminderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reminder, invoices } = await getCustomerReminderDetail(id);
  if (!reminder) notFound();
  return <ModulePage><CustomerReminderDetail reminder={reminder} invoices={invoices} /></ModulePage>;
}
