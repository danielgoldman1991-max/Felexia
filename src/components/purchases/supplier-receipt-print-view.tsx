import { documentIdentityInfoLines, documentIdentityContact, documentTaxSummary, formatDocumentMoney, formatDocumentNumber } from "@/lib/print-format";
import { formatDate, formatNumber } from "@/lib/format";
import type { PurchaseDocumentLineRecord, PurchaseDocumentRecord } from "@/lib/purchase-types";
import { SUPPLIER_RECEIPT_STATUS_LABELS } from "@/lib/purchase-types";
import type { OrganizationIdentity } from "@/lib/company-identity";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintPartyCard } from "@/components/print/PrintPartyCard";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintTotals } from "@/components/print/PrintTotals";
import { PrintFooter } from "@/components/print/PrintFooter";
import { PrintSummary } from "@/components/print/PrintSummary";
import { PrintTaxSummary } from "@/components/print/PrintTaxSummary";
import { PrintTerms } from "@/components/print/PrintTerms";

export function SupplierReceiptPrintView({
  document,
  lines,
  identity,
}: {
  document: PurchaseDocumentRecord;
  lines: PurchaseDocumentLineRecord[];
  identity: OrganizationIdentity;
}) {
  const currency = document.currency || identity.currency;
  const money = (value: number | null | undefined) => formatDocumentMoney(value, currency);
  const companyInfoLines = documentIdentityInfoLines(identity);
  const companyContact = documentIdentityContact(identity);
  const discountPresent = lines.some((line) => line.discount_rate > 0);

  return (
    <PrintPage>
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
        <PrintDocumentTitle title="BON DE RÉCEPTION" documentNumber={document.document_number}>
          <p><strong>Date :</strong> {formatDate(document.receipt_date ?? document.document_date)}</p>
          <p><strong>Statut :</strong> {SUPPLIER_RECEIPT_STATUS_LABELS[document.status] ?? document.status}</p>
          {document.related_order_number ? <p><strong>Commande :</strong> {document.related_order_number}</p> : null}
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard
        title="Fournisseur"
        lines={[
          document.supplier_name,
          document.supplier_phone ? `Tél. : ${document.supplier_phone}` : null,
          document.supplier_email,
          document.supplier_ice ? `ICE : ${document.supplier_ice}` : null,
          document.warehouse_name ? `Emplacement : ${document.warehouse_name}` : null,
        ].filter(Boolean) as string[]}
      />

      <PrintLineTable currency={currency}
        head={
          <>
            <th>#</th>
            <th>Désignation / article</th>
            <th>Unité</th>
            <th className="right">Quantité</th>
            <th className="right">Prix HT</th>
            {discountPresent ? <th className="right">Remise</th> : null}
            <th className="right">Total HT</th>
            <th className="right">TVA %</th>
            <th className="right">Total TTC</th>
          </>
        }
      >
        {lines.map((line, i) => (
          <tr key={line.id}>
            <td>{i + 1}</td>
            <td><p className="strong">{line.description}</p>{line.product_name ? <p className="muted">{line.product_name}</p> : null}</td>
            <td>{line.unit_name ?? "-"}</td>
            <td className="num strong">{formatNumber(line.quantity)}</td>
            <td className="num">{formatDocumentNumber(line.unit_price_ht)}</td>
            {discountPresent ? <td className="num">{line.discount_rate > 0 ? `${formatNumber(line.discount_rate)} %` : "—"}</td> : null}
            <td className="num">{formatDocumentNumber(line.subtotal_ht)}</td>
            <td className="num">{line.tax_rate_id ? `${line.tax_rate}%` : "-"}</td>
            <td className="num">{formatDocumentNumber(line.total_ttc)}</td>
          </tr>
        ))}
      </PrintLineTable>

      <PrintSummary aside={<>
        <PrintTaxSummary rows={documentTaxSummary(lines, currency)} />
        {document.notes ? <PrintTerms title="Notes">{document.notes}</PrintTerms> : null}
      </>}>
      <PrintTotals
        rows={[
          { label: "Total HT", value: money(document.subtotal_ht) },
          ...(document.discount_total > 0 ? [{ label: "Remises déjà déduites", value: money(document.discount_total) }] : []),
          { label: "Total TVA", value: money(document.tax_total) },
        ]}
        grandTotalLabel="Total TTC"
        grandTotalValue={money(document.total_ttc)}
      />
      </PrintSummary>

      <section className="print-signature print-signature-duo">
        <div className="print-signature-box">Réceptionné par</div>
        <div className="print-signature-box">Contrôlé par</div>
      </section>

      <PrintFooter footerText={identity.footerText || "Bon de réception fournisseur · Document logistique"} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
