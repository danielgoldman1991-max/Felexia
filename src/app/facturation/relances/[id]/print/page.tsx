import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintPartyCard } from "@/components/print/PrintPartyCard";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintTotals } from "@/components/print/PrintTotals";
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintFooter } from "@/components/print/PrintFooter";
import { getCustomerReminderDetail } from "@/lib/reminders";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomerReminderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reminder, invoices } = await getCustomerReminderDetail(id);
  if (!reminder) notFound();
  const identity = await getOrganizationDocumentIdentity(reminder.organization_id);

  const companyInfoLines = [
    identity.city && identity.country ? `${identity.city}, ${identity.country}` : null,
    identity.ice ? `ICE : ${identity.ice}` : null,
  ].filter(Boolean) as string[];

  const companyContact = [identity.email, identity.phone].filter(Boolean).join(" - ");

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <PrintActions backHref={`/facturation/relances/${reminder.id}`} backLabel="Retour relance" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
          <PrintDocumentTitle title="RELANCE CLIENT" documentNumber={reminder.reminder_number}>
            <p><strong>Date :</strong> {formatDate(reminder.reminder_date)}</p>
            <p><strong>Niveau :</strong> {reminder.reminder_level}</p>
          </PrintDocumentTitle>
        </PrintHeader>

        <PrintPartyCard title="Client" lines={[reminder.customer_name].filter(Boolean) as string[]} />

        {reminder.subject ? <PrintTerms title={reminder.subject}>{reminder.message}</PrintTerms> : null}

        {invoices.length > 0 ? (
          <PrintLineTable
            head={
              <>
                <th>#</th>
                <th>Facture</th>
                <th>Échéance</th>
                <th className="right">Retard</th>
                <th className="right">Reste à payer</th>
              </>
            }
          >
            {invoices.map((invoice, index) => (
              <tr key={invoice.id}>
                <td>{index + 1}</td>
                <td className="strong">{invoice.invoice_number}</td>
                <td>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</td>
                <td className="num">{invoice.days_overdue ?? 0} j</td>
                <td className="num strong">{formatMoney(invoice.remaining_amount)}</td>
              </tr>
            ))}
          </PrintLineTable>
        ) : null}

        <PrintTotals
          rows={[]}
          grandTotalLabel="Total en retard"
          grandTotalValue={formatMoney(reminder.total_overdue_amount)}
        />

        <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
      </PrintPage>
    </main>
  );
}
