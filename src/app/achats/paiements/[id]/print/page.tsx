import { notFound } from "next/navigation";
import { getSupplierPaymentDetail } from "@/lib/purchases";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { formatDate } from "@/lib/format";
import { SUPPLIER_PAYMENT_STATUS_LABELS } from "@/lib/purchase-types";
import { documentIdentityContact, documentIdentityInfoLines, documentPaymentMethodLabel, formatDocumentMoney, formatDocumentNumber } from "@/lib/print-format";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintPartyCard } from "@/components/print/PrintPartyCard";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintSummary } from "@/components/print/PrintSummary";
import { PrintTotals } from "@/components/print/PrintTotals";
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintSignature } from "@/components/print/PrintSignature";
import { PrintFooter } from "@/components/print/PrintFooter";

export const dynamic = "force-dynamic";

export default async function SupplierPaymentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Reuse the same active-workspace scoped reader as the detail page.
  const { payment, allocations } = await getSupplierPaymentDetail(id);
  if (!payment) notFound();
  const identity = await getOrganizationDocumentIdentity(payment.organization_id);
  const currency = payment.currency || identity.currency;
  const money = (value: number | null | undefined) => formatDocumentMoney(value, currency);
  const companyContact = documentIdentityContact(identity);
  const reference = payment.reference || payment.transfer_reference || payment.check_number;

  return (
    <div className="print-preview">
      <PrintActions backHref={`/achats/paiements/${payment.id}`} backLabel="Retour au règlement" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={documentIdentityInfoLines(identity)} contact={companyContact} />
          <PrintDocumentTitle title="RÈGLEMENT FOURNISSEUR" documentNumber={payment.payment_number}>
            <p><strong>Date :</strong> {formatDate(payment.payment_date)}</p>
            <p><strong>Statut :</strong> {SUPPLIER_PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}</p>
            {payment.payment_method ? <p><strong>Modalité :</strong> {documentPaymentMethodLabel(payment.payment_method)}</p> : null}
            {reference ? <p><strong>Référence :</strong> {reference}</p> : null}
            {payment.bank_name ? <p><strong>Banque :</strong> {payment.bank_name}</p> : null}
          </PrintDocumentTitle>
        </PrintHeader>
        <PrintPartyCard title="Fournisseur" lines={[payment.supplier_name].filter(Boolean) as string[]} />
        {allocations.length > 0 ? (
          <PrintLineTable currency={currency} head={<><th>#</th><th>Facture</th><th>Date d’affectation</th><th className="right">Montant affecté</th></>}>
            {allocations.map((allocation, index) => (
              <tr key={allocation.id}>
                <td>{index + 1}</td>
                <td className="strong">{allocation.invoice_number || "Facture"}</td>
                <td>{formatDate(allocation.allocation_date)}</td>
                <td className="num strong">{formatDocumentNumber(allocation.amount)}</td>
              </tr>
            ))}
          </PrintLineTable>
        ) : null}
        <PrintSummary aside={payment.notes ? <PrintTerms title="Notes">{payment.notes}</PrintTerms> : undefined}>
          <PrintTotals rows={[]} grandTotalLabel="Montant du règlement" grandTotalValue={money(payment.amount)} settlementRows={[
            { label: "Montant affecté", value: money(payment.allocated_amount) },
            { label: "Montant non affecté", value: money(payment.available_amount) },
          ]} />
        </PrintSummary>
        <PrintSignature label="Signature et cachet" />
        <PrintFooter footerText={identity.footerText || "Justificatif de suivi du règlement fournisseur."} name={identity.name} contact={companyContact} />
      </PrintPage>
    </div>
  );
}
