import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { PurchaseDocumentLineRecord, PurchaseDocumentRecord } from "@/lib/purchase-types";
import type { OrganizationIdentity } from "@/lib/company-identity";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintPartyCard } from "@/components/print/PrintPartyCard";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintTotals } from "@/components/print/PrintTotals";
import { PrintFooter } from "@/components/print/PrintFooter";

export function SupplierReceiptPrintView({
  document,
  lines,
  identity,
}: {
  document: PurchaseDocumentRecord;
  lines: PurchaseDocumentLineRecord[];
  identity: OrganizationIdentity;
}) {
  const companyInfoLines = [
    identity.city && identity.country ? `${identity.city}, ${identity.country}` : null,
    identity.ice ? `ICE : ${identity.ice}` : null,
  ].filter(Boolean) as string[];

  return (
    <PrintPage>
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} />
        <PrintDocumentTitle title="BON DE RÉCEPTION" documentNumber={document.document_number}>
          <p><strong>Date :</strong> {formatDate(document.receipt_date ?? document.document_date)}</p>
          {document.related_order_number ? <p><strong>Commande :</strong> {document.related_order_number}</p> : null}
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard
        title="Fournisseur"
        lines={[
          document.supplier_name,
          document.warehouse_name ? `Emplacement : ${document.warehouse_name}` : null,
        ].filter(Boolean) as string[]}
      />

      <PrintLineTable
        head={
          <>
            <th>#</th>
            <th>Article</th>
            <th>Description</th>
            <th>Unité</th>
            <th className="right">Qte</th>
            <th className="right">Prix HT</th>
            <th className="right">Remise %</th>
            <th className="right">Total HT</th>
            <th className="right">TVA %</th>
            <th className="right">Total TTC</th>
          </>
        }
      >
        {lines.map((line, i) => (
          <tr key={line.id}>
            <td>{i + 1}</td>
            <td>{line.product_name || "Ligne libre"}</td>
            <td>{line.description}</td>
            <td>{line.unit_name ?? "-"}</td>
            <td className="num strong">{formatNumber(line.quantity)}</td>
            <td className="num">{formatMoney(line.unit_price_ht)}</td>
            <td className="num">{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</td>
            <td className="num">{formatMoney(line.subtotal_ht)}</td>
            <td className="num">{line.tax_rate_id ? `${line.tax_rate}%` : "-"}</td>
            <td className="num">{formatMoney(line.total_ttc)}</td>
          </tr>
        ))}
      </PrintLineTable>

      <PrintTotals
        rows={[
          { label: "Total HT", value: formatMoney(document.subtotal_ht) },
          { label: "Total TVA", value: formatMoney(document.tax_total) },
        ]}
        grandTotalLabel="Total TTC"
        grandTotalValue={formatMoney(document.total_ttc)}
      />

      <section className="print-signature print-signature-duo">
        <div className="print-signature-box">Réceptionné par</div>
        <div className="print-signature-box">Contrôlé par</div>
      </section>

      <PrintFooter footerText="Bon de réception fournisseur - Document logistique" name={identity.name} />
    </PrintPage>
  );
}
