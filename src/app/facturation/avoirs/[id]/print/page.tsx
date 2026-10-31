import { documentIdentityInfoLines, documentIdentityContact, documentTaxSummary, formatDocumentMoney, formatDocumentNumber } from "@/lib/print-format";
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
import { PrintSummary } from "@/components/print/PrintSummary";
import { PrintTaxSummary } from "@/components/print/PrintTaxSummary";
import { getCustomerCreditNoteDetail } from "@/lib/credit-notes";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { formatDate, formatNumber } from "@/lib/format";
import { CREDIT_NOTE_STATUS_LABELS } from "@/lib/credit-note-types";

export const dynamic = "force-dynamic";

export default async function CreditNotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creditNote, lines } = await getCustomerCreditNoteDetail(id);
  if (!creditNote) notFound();
  const identity = await getOrganizationDocumentIdentity(creditNote.organization_id);

  const currency = creditNote.currency || identity.currency;
  const money = (value: number | null | undefined) => formatDocumentMoney(value, currency);
  const companyInfoLines = documentIdentityInfoLines(identity);

  const companyContact = documentIdentityContact(identity);
  const discountPresent = lines.some((line) => line.discount_rate > 0);

  return (
    <div className="print-preview">
      <PrintActions backHref={`/facturation/avoirs/${creditNote.id}`} backLabel="Retour avoir" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
          <PrintDocumentTitle title="AVOIR CLIENT" documentNumber={creditNote.credit_note_number}>
            <p><strong>Date :</strong> {formatDate(creditNote.credit_note_date)}</p>
            <p><strong>Statut :</strong> {CREDIT_NOTE_STATUS_LABELS[creditNote.status] ?? creditNote.status}</p>
            {creditNote.source_return_number ? <p><strong>Origine :</strong> Bon de retour {creditNote.source_return_number}</p> : null}
            {creditNote.source_invoice_number ? <p><strong>Facture source :</strong> {creditNote.source_invoice_number}</p> : null}
          </PrintDocumentTitle>
        </PrintHeader>

        <PrintPartyCard title="Client" lines={[creditNote.customer_name].filter(Boolean) as string[]} />

        <PrintLineTable currency={currency}
          head={
            <>
              <th>#</th>
              <th>Désignation</th>
              <th className="right">Quantité</th>
              <th className="right">Prix HT</th>
              {discountPresent ? <th className="right">Remise</th> : null}
              <th className="right">TVA</th>
              <th className="right">Total TTC</th>
            </>
          }
        >
          {lines.map((line, index) => (
            <tr key={line.id}>
              <td>{index + 1}</td>
              <td>{line.description}</td>
              <td className="num">{formatNumber(line.quantity)}</td>
              <td className="num">{formatDocumentNumber(line.unit_price_ht)}</td>
              {discountPresent ? <td className="num">{line.discount_rate > 0 ? `${formatNumber(line.discount_rate)} %` : "—"}</td> : null}
              <td className="num">{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</td>
              <td className="num strong">{formatDocumentNumber(line.total_ttc)}</td>
            </tr>
          ))}
        </PrintLineTable>

        <PrintSummary aside={<>
          <PrintTaxSummary rows={documentTaxSummary(lines, currency)} />
          {creditNote.reason ? <PrintTerms title="Motif">{creditNote.reason}</PrintTerms> : null}
          {creditNote.notes ? <PrintTerms title="Notes">{creditNote.notes}</PrintTerms> : null}
        </>}>
        <PrintTotals
          rows={[
            { label: "Total HT", value: money(creditNote.subtotal_ht) },
            ...(creditNote.discount_total > 0 ? [{ label: "Remises déjà déduites", value: money(creditNote.discount_total) }] : []),
            { label: "Total TVA", value: money(creditNote.tax_total) },
          ]}
          grandTotalLabel="Total TTC"
          grandTotalValue={money(creditNote.total_ttc)}
          settlementRows={[
            { label: "Montant imputé", value: money(creditNote.applied_amount) },
            { label: "Solde d’avoir disponible", value: money(creditNote.available_amount) },
          ]}
        />
        </PrintSummary>

        <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
      </PrintPage>
    </div>
  );
}
