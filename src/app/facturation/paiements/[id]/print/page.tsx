import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintPartyCard } from "@/components/print/PrintPartyCard";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintTotals } from "@/components/print/PrintTotals";
import { PrintSignature } from "@/components/print/PrintSignature";
import { PrintFooter } from "@/components/print/PrintFooter";
import { getCustomerPaymentDetail } from "@/lib/payments";
import { formatDate, formatMoney } from "@/lib/format";
import { getPaymentMethodLabel } from "@/lib/payment-terms";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { requireActiveWorkspace } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerPaymentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, allocations } = await getCustomerPaymentDetail(id);
  if (!payment) notFound();
  const workspace = await requireActiveWorkspace();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);

  const companyInfoLines = [
    identity.city && identity.country ? `${identity.city}, ${identity.country}` : null,
    identity.ice ? `ICE : ${identity.ice}` : null,
  ].filter(Boolean) as string[];

  const companyContact = [identity.email, identity.phone].filter(Boolean).join(" - ");

  const reference =
    payment.reference ?? payment.transfer_reference ?? payment.check_number ?? null;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <PrintActions backHref={`/facturation/paiements/${payment.id}`} backLabel="Retour paiement" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
          <PrintDocumentTitle title="REÇU DE PAIEMENT" documentNumber={payment.payment_number}>
            <p><strong>Date :</strong> {formatDate(payment.payment_date)}</p>
            <p><strong>Modalité :</strong> {getPaymentMethodLabel(payment.payment_method) ?? payment.payment_method}</p>
            {reference ? <p><strong>Référence :</strong> {reference}</p> : null}
          </PrintDocumentTitle>
        </PrintHeader>

        <PrintPartyCard title="Client" lines={[payment.customer_name].filter(Boolean) as string[]} />

        {allocations.length > 0 ? (
          <PrintLineTable
            head={
              <>
                <th>#</th>
                <th>Facture</th>
                <th>Date</th>
                <th className="right">Montant affecté</th>
              </>
            }
          >
            {allocations.map((allocation, index) => (
              <tr key={allocation.id}>
                <td>{index + 1}</td>
                <td className="strong">{allocation.invoice_number}</td>
                <td>{formatDate(allocation.allocation_date)}</td>
                <td className="num strong">{formatMoney(allocation.amount)}</td>
              </tr>
            ))}
          </PrintLineTable>
        ) : null}

        <PrintTotals
          rows={[
            { label: "Montant affecté", value: formatMoney(payment.allocated_amount) },
            { label: "Disponible", value: formatMoney(payment.available_amount) },
          ]}
          grandTotalLabel="Montant"
          grandTotalValue={formatMoney(payment.amount)}
        />

        <PrintSignature label="Signature et cachet" />

        <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
      </PrintPage>
    </main>
  );
}
