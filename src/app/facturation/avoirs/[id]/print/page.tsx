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
import { getCustomerCreditNoteDetail } from "@/lib/credit-notes";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CreditNotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creditNote, lines } = await getCustomerCreditNoteDetail(id);
  if (!creditNote) notFound();
  const identity = await getOrganizationDocumentIdentity(creditNote.organization_id);

  const companyInfoLines = [
    identity.city && identity.country ? `${identity.city}, ${identity.country}` : null,
    identity.ice ? `ICE : ${identity.ice}` : null,
  ].filter(Boolean) as string[];

  const companyContact = [identity.email, identity.phone].filter(Boolean).join(" - ");

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <PrintActions backHref={`/facturation/avoirs/${creditNote.id}`} backLabel="Retour avoir" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
          <PrintDocumentTitle title="AVOIR CLIENT" documentNumber={creditNote.credit_note_number}>
            <p><strong>Date :</strong> {formatDate(creditNote.credit_note_date)}</p>
            {creditNote.source_return_number ? <p><strong>Origine :</strong> Bon de retour {creditNote.source_return_number}</p> : null}
            {creditNote.source_invoice_number ? <p><strong>Facture source :</strong> {creditNote.source_invoice_number}</p> : null}
          </PrintDocumentTitle>
        </PrintHeader>

        <PrintPartyCard title="Client" lines={[creditNote.customer_name].filter(Boolean) as string[]} />

        <PrintLineTable
          head={
            <>
              <th>#</th>
              <th>Désignation</th>
              <th className="right">Quantité</th>
              <th className="right">Prix HT</th>
              <th className="right">TVA</th>
              <th className="right">Total TTC</th>
            </>
          }
        >
          {lines.map((line, index) => (
            <tr key={line.id}>
              <td>{index + 1}</td>
              <td>{line.description}</td>
              <td className="num">{formatMoney(line.quantity)}</td>
              <td className="num">{formatMoney(line.unit_price_ht)}</td>
              <td className="num">{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</td>
              <td className="num strong">{formatMoney(line.total_ttc)}</td>
            </tr>
          ))}
        </PrintLineTable>

        <PrintTotals
          rows={[
            { label: "Total HT", value: formatMoney(creditNote.subtotal_ht) },
            { label: "Total TVA", value: formatMoney(creditNote.tax_total) },
            { label: "Disponible", value: formatMoney(creditNote.available_amount) },
          ]}
          grandTotalLabel="Total TTC"
          grandTotalValue={formatMoney(creditNote.total_ttc)}
        />

        {creditNote.reason ? <PrintTerms title="Motif">{creditNote.reason}</PrintTerms> : null}

        <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
      </PrintPage>
    </main>
  );
}
