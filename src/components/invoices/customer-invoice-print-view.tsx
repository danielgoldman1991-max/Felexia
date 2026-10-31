import { documentIdentityInfoLines, documentIdentityContact, documentPaymentMethodLabel, documentTaxRateLabel, documentTaxSummary, formatDocumentMoney, formatDocumentNumber } from "@/lib/print-format";
import { formatDate, formatNumber } from "@/lib/format";
import { getPaymentTermLabel } from "@/lib/payment-terms";
import { INVOICE_PAYMENT_STATUS_LABELS, INVOICE_STATUS_LABELS } from "@/lib/invoice-types";
import type { CustomerInvoiceLineRecord, CustomerInvoiceRecord } from "@/lib/invoice-types";
import { hasDiscount } from "@/lib/sales-types";
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

export function CustomerInvoicePrintView({
  invoice,
  lines,
  identity,
}: {
  invoice: CustomerInvoiceRecord;
  lines: CustomerInvoiceLineRecord[];
  identity: OrganizationIdentity;
}) {
  const discountPresent = hasDiscount(lines);
  const clientLines = [
    invoice.customer_name,
    invoice.customer_address,
    invoice.customer_city,
    invoice.customer_phone ? `Tel. : ${invoice.customer_phone}` : null,
    invoice.customer_email ? `Email : ${invoice.customer_email}` : null,
    invoice.customer_ice ? `ICE : ${invoice.customer_ice}` : null,
  ].filter(Boolean) as string[];

  const currency = invoice.currency || identity.currency;
  const money = (value: number | null | undefined) => formatDocumentMoney(value, currency);
  const companyInfoLines = documentIdentityInfoLines(identity);

  const companyContact = documentIdentityContact(identity);
  const paymentTerms = invoice.custom_payment_terms || getPaymentTermLabel(invoice.payment_terms) || (invoice.payment_terms_days ? `${invoice.payment_terms_days} jours` : null);
  const paymentMethod = invoice.custom_payment_method || documentPaymentMethodLabel(invoice.payment_method);

  return (
    <PrintPage>
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
        <PrintDocumentTitle title="FACTURE" documentNumber={invoice.invoice_number}>
          <p><strong>Date :</strong> {formatDate(invoice.invoice_date)}</p>
          {invoice.due_date ? <p><strong>Échéance :</strong> {formatDate(invoice.due_date)}</p> : null}
          <p><strong>Statut :</strong> {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</p>
          <p><strong>Paiement :</strong> {INVOICE_PAYMENT_STATUS_LABELS[invoice.payment_status] ?? invoice.payment_status}</p>
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard title="Client" lines={clientLines} />

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
            <th className="right">Total HT</th>
            <th className="right">Total TTC</th>
          </>
        }
      >
        {lines.map((line, index) => (
          <tr key={line.id}>
            <td>{index + 1}</td>
            <td>
              <p className="strong">{line.description}</p>
              {line.product_name ? <p className="muted">{line.product_name}</p> : null}
            </td>
            <td className="num">{formatNumber(line.quantity)}</td>
            <td>{line.unit_name ?? "-"}</td>
            <td className="num">{formatDocumentNumber(line.unit_price_ht)}</td>
            {discountPresent ? <td className="num">{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</td> : null}
            <td className="num">
              {documentTaxRateLabel(line)}
            </td>
            <td className="num">{formatDocumentNumber(line.subtotal_ht)}</td>
            <td className="num strong">{formatDocumentNumber(line.total_ttc)}</td>
          </tr>
        ))}
      </PrintLineTable>

      <PrintSummary aside={<>
        <PrintTaxSummary rows={documentTaxSummary(lines, currency)} />
        {paymentTerms || paymentMethod ? <PrintTerms title="Conditions de règlement">{[paymentTerms, paymentMethod].filter(Boolean).join(" · ")}</PrintTerms> : null}
        {invoice.notes ? <PrintTerms title="Notes">{invoice.notes}</PrintTerms> : null}
      </>}>
      <PrintTotals
        rows={[
          { label: "Total HT", value: money(invoice.subtotal_ht) },
          ...(invoice.discount_total > 0 ? [{ label: "Remises déjà déduites", value: money(invoice.discount_total) }] : []),
          { label: "Total TVA", value: money(invoice.tax_total) },
        ]}
        grandTotalLabel="Total TTC"
        grandTotalValue={money(invoice.total_ttc)}
        settlementRows={[
          { label: "Montant payé", value: money(invoice.paid_amount) },
          ...(invoice.credit_amount > 0 ? [{ label: "Avoirs imputés", value: money(invoice.credit_amount) }] : []),
          { label: "Reste à payer", value: money(invoice.remaining_amount) },
        ]}
      />
      </PrintSummary>

      <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
