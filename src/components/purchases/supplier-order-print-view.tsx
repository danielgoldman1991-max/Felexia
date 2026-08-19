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
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintFooter } from "@/components/print/PrintFooter";

export function SupplierOrderPrintView({
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

  const companyContact = [identity.email, identity.phone].filter(Boolean).join(" - ");

  return (
    <PrintPage>
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
        <PrintDocumentTitle title="COMMANDE FOURNISSEUR" documentNumber={document.document_number}>
          <p><strong>Date :</strong> {formatDate(document.document_date)}</p>
          {document.expected_receipt_date ? <p><strong>Réception prévue :</strong> {formatDate(document.expected_receipt_date)}</p> : null}
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard
        title="Fournisseur"
        lines={[document.supplier_name, document.supplier_ice ? `ICE : ${document.supplier_ice}` : null].filter(Boolean) as string[]}
      />

      <PrintLineTable
        head={
          <>
            <th>#</th>
            <th>Désignation</th>
            <th className="right">Quantité</th>
            <th>Unité</th>
            <th className="right">Prix HT</th>
            <th className="right">Remise</th>
            <th className="right">TVA</th>
            <th className="right">Total HT</th>
            <th className="right">Total TTC</th>
          </>
        }
      >
        {lines.map((line, i) => (
          <tr key={line.id}>
            <td>{i + 1}</td>
            <td>
              <p className="strong">{line.description}</p>
              {line.product_name ? <p className="muted">{line.product_name}</p> : null}
            </td>
            <td className="num">{formatNumber(line.quantity)}</td>
            <td>{line.unit_name ?? "-"}</td>
            <td className="num">{formatMoney(line.unit_price_ht)}</td>
            <td className="num">{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</td>
            <td className="num">{line.tax_rate_id ? `${line.tax_rate}%` : "-"}</td>
            <td className="num">{formatMoney(line.subtotal_ht)}</td>
            <td className="num strong">{formatMoney(line.total_ttc)}</td>
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

      {document.notes ? <PrintTerms title="Notes">{document.notes}</PrintTerms> : null}

      <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
