import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { getCustomerReminderDetail } from "@/lib/reminders";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { formatDate } from "@/lib/format";
import { PrintCompanyBrand } from "@/components/shared/print-company-brand";

export const dynamic = "force-dynamic";

export default async function CustomerReminderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reminder, invoices } = await getCustomerReminderDetail(id);
  if (!reminder) notFound();
  const identity = await getOrganizationDocumentIdentity(reminder.organization_id);
  return (
    <main className="mx-auto max-w-4xl bg-white p-8 print:p-0">
      <PrintActions backHref={`/facturation/relances/${reminder.id}`} backLabel="Retour relance" />
      <div className="flex items-start justify-between border-b border-slate-200 pb-6">
        <PrintCompanyBrand identity={identity} />
        <div className="text-right">
          <h1 className="text-2xl font-bold">RELANCE CLIENT</h1>
          <p className="mt-2">{reminder.reminder_number}</p>
          <p>{formatDate(reminder.reminder_date)}</p>
          <p>Niveau {reminder.reminder_level}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div><p className="text-sm text-[var(--muted)]">Client</p><p className="font-semibold">{reminder.customer_name}</p></div>
      </div>
      <div className="mt-6">
        <p className="font-semibold">{reminder.subject}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6">{reminder.message}</p>
      </div>
      <div className="mt-6">
        <Table>
          <thead><tr><Th>Facture</Th><Th>Echeance</Th><Th>Retard</Th><Th>Reste a payer</Th></tr></thead>
          <tbody>{invoices.map((invoice) => <tr key={invoice.id}><Td>{invoice.invoice_number}</Td><Td>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</Td><Td>{invoice.days_overdue ?? 0} j</Td><Td><MoneyDisplay value={invoice.remaining_amount} /></Td></tr>)}</tbody>
        </Table>
      </div>
      <div className="mt-8 text-right text-lg font-semibold">Total en retard : <MoneyDisplay value={reminder.total_overdue_amount} /></div>
    </main>
  );
}
