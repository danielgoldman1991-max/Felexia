import { documentIdentityInfoLines, documentIdentityContact, documentPaymentMethodLabel, formatDocumentMoney, formatDocumentNumber } from "@/lib/print-format";
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
import { PrintSummary } from "@/components/print/PrintSummary";
import { PrintTerms } from "@/components/print/PrintTerms";
import { getCustomerPaymentDetail } from "@/lib/payments";
import { formatDate } from "@/lib/format";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { requireActiveWorkspace } from "@/lib/auth";
import { CUSTOMER_PAYMENT_STATUS_LABELS } from "@/lib/payment-types";

export const dynamic = "force-dynamic";

export default async function CustomerPaymentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, allocations } = await getCustomerPaymentDetail(id);
  if (!payment) notFound();
  const workspace = await requireActiveWorkspace();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);

  const currency = payment.currency || identity.currency;
  const money = (value: number | null | undefined) => formatDocumentMoney(value, currency);
  const companyInfoLines = documentIdentityInfoLines(identity);

  const companyContact = documentIdentityContact(identity);

  const reference =
    payment.reference || payment.transfer_reference || payment.check_number || null;

  return (
    <div className="print-preview">
      <PrintActions backHref={`/facturation/paiements/${payment.id}`} backLabel="Retour paiement" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
          <PrintDocumentTitle title="REÇU DE PAIEMENT" documentNumber={payment.payment_number}>
            <p><strong>Date :</strong> {formatDate(payment.payment_date)}</p>
            <p><strong>Statut :</strong> {CUSTOMER_PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}</p>
            {payment.payment_method ? <p><strong>Modalité :</strong> {documentPaymentMethodLabel(payment.payment_method)}</p> : null}
            {reference ? <p><strong>Référence :</strong> {reference}</p> : null}
          </PrintDocumentTitle>
        </PrintHeader>

        <PrintPartyCard title="Client" lines={[payment.customer_name].filter(Boolean) as string[]} />

        {allocations.length > 0 ? (
          <PrintLineTable currency={currency}
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
                <td className="num strong">{formatDocumentNumber(allocation.amount)}</td>
              </tr>
            ))}
          </PrintLineTable>
        ) : null}

        <PrintSummary aside={payment.notes ? <PrintTerms title="Notes">{payment.notes}</PrintTerms> : undefined}>
        <PrintTotals
          rows={[]}
          grandTotalLabel="Montant du règlement"
          grandTotalValue={money(payment.amount)}
          settlementRows={[
            { label: "Montant affecté", value: money(payment.allocated_amount) },
            { label: "Montant non affecté", value: money(payment.available_amount) },
          ]}
        />
        </PrintSummary>

        <PrintSignature label="Signature et cachet" />

        <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
      </PrintPage>
    </div>
  );
}
