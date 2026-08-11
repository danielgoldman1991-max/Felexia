import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { SupplierInvoiceLineRecord, SupplierInvoiceRecord } from "@/lib/purchase-types";
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

export function SupplierInvoicePrintView({
  invoice,
  lines,
  identity,
}: {
  invoice: SupplierInvoiceRecord;
  lines: SupplierInvoiceLineRecord[];
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
        <PrintDocumentTitle title="FACTURE FOURNISSEUR" documentNumber={invoice.invoice_number}>
          <p><strong>Date :</strong> {formatDate(invoice.invoice_date)}</p>
          {invoice.due_date ? <p><strong>Échéance :</strong> {formatDate(invoice.due_date)}</p> : null}
          {invoice.supplier_invoice_number ? <p><strong>N° facture fournisseur :</strong> {invoice.supplier_invoice_number}</p> : null}
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard
        title="Fournisseur"
        lines={[
          invoice.supplier_name,
          invoice.supplier_ice ? `ICE : ${invoice.supplier_ice}` : null,
        ].filter(Boolean) as string[]}
      />

      <PrintLineTable
        head={
          <>
            <th>#</th>
            <th>Désignation</th>
            <th className="right">Quantité</th>
            <th>Unité</th>
            <th className="right">Prix HT</th>
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
            <td className="num">{line.tax_rate_id ? `${line.tax_rate}%` : "-"}</td>
            <td className="num">{formatMoney(line.subtotal_ht)}</td>
            <td className="num strong">{formatMoney(line.total_ttc)}</td>
          </tr>
        ))}
      </PrintLineTable>

      <PrintTotals
        rows={[
          { label: "Total HT", value: formatMoney(invoice.subtotal_ht) },
          { label: "Total TVA", value: formatMoney(invoice.tax_total) },
        ]}
        grandTotalLabel="Total TTC"
        grandTotalValue={formatMoney(invoice.total_ttc)}
      />

      {invoice.notes ? <PrintTerms title="Notes">{invoice.notes}</PrintTerms> : null}

      <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
