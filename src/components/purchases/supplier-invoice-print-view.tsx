import { documentIdentityInfoLines, documentIdentityContact, documentTaxSummary, formatDocumentMoney, formatDocumentNumber } from "@/lib/print-format";
import { formatDate, formatNumber } from "@/lib/format";
import type { SupplierInvoiceLineRecord, SupplierInvoiceRecord } from "@/lib/purchase-types";
import { SUPPLIER_INVOICE_STATUS_LABELS } from "@/lib/purchase-types";
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
import { PrintSummary } from "@/components/print/PrintSummary";
import { PrintTaxSummary } from "@/components/print/PrintTaxSummary";

export function SupplierInvoicePrintView({
  invoice,
  lines,
  identity,
}: {
  invoice: SupplierInvoiceRecord;
  lines: SupplierInvoiceLineRecord[];
  identity: OrganizationIdentity;
}) {
  const currency = invoice.currency || identity.currency;
  const money = (value: number | null | undefined) => formatDocumentMoney(value, currency);
  const companyInfoLines = documentIdentityInfoLines(identity);

  const companyContact = documentIdentityContact(identity);
  const discountPresent = lines.some((line) => line.discount_rate > 0);

  return (
    <PrintPage>
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
        <PrintDocumentTitle title="FACTURE FOURNISSEUR" documentNumber={invoice.invoice_number}>
          <p className="print-document-note">Copie de suivi des achats</p>
          <p><strong>Date :</strong> {formatDate(invoice.invoice_date)}</p>
          <p><strong>Statut :</strong> {SUPPLIER_INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</p>
          {invoice.due_date ? <p><strong>Échéance :</strong> {formatDate(invoice.due_date)}</p> : null}
          {invoice.supplier_invoice_number ? <p><strong>N° facture fournisseur :</strong> {invoice.supplier_invoice_number}</p> : null}
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard
        title="Fournisseur"
        lines={[
          invoice.supplier_name,
          invoice.supplier_phone ? `Tél. : ${invoice.supplier_phone}` : null,
          invoice.supplier_email,
          invoice.supplier_ice ? `ICE : ${invoice.supplier_ice}` : null,
        ].filter(Boolean) as string[]}
      />

      <PrintLineTable currency={currency}
        head={
          <>
            <th>#</th>
            <th>Désignation</th>
            <th className="right">Quantité</th>
            <th>Unité</th>
            <th className="right">Prix HT</th>
            {discountPresent ? <th className="right">Remise</th> : null}
            <th className="right">TVA</th>
            <th className="right">{discountPresent ? "HT avant remise" : "Total HT"}</th>
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
            <td className="num">{formatDocumentNumber(line.unit_price_ht)}</td>
            {discountPresent ? <td className="num">{line.discount_rate > 0 ? `${formatNumber(line.discount_rate)} %` : "—"}</td> : null}
            <td className="num">{line.tax_rate_id ? `${line.tax_rate}%` : "-"}</td>
            <td className="num">{formatDocumentNumber(line.subtotal_ht)}</td>
            <td className="num strong">{formatDocumentNumber(line.total_ttc)}</td>
          </tr>
        ))}
      </PrintLineTable>

      <PrintSummary aside={<>
        <PrintTaxSummary rows={documentTaxSummary(lines, currency)} />
        {invoice.notes ? <PrintTerms title="Notes">{invoice.notes}</PrintTerms> : null}
      </>}>
      <PrintTotals
        rows={[
          { label: invoice.discount_total > 0 ? "HT avant remise" : "Total HT", value: money(invoice.subtotal_ht) },
          ...(invoice.discount_total > 0 ? [{ label: "Remises", value: money(-invoice.discount_total) }, { label: "Total HT net", value: money(invoice.subtotal_ht - invoice.discount_total) }] : []),
          { label: "Total TVA", value: money(invoice.tax_total) },
        ]}
        grandTotalLabel="Total TTC"
        grandTotalValue={money(invoice.total_ttc)}
        settlementRows={[
          { label: "Montant payé", value: money(invoice.paid_amount) },
          ...(Number(invoice.credit_amount || 0) > 0 ? [{ label: "Avoirs déduits", value: money(invoice.credit_amount) }] : []),
          { label: "Reste à payer", value: money(invoice.remaining_amount) },
        ]}
      />
      </PrintSummary>

      <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
