import { formatDate, formatMoney } from "@/lib/format";
import { getPaymentTermLabel, getPaymentMethodLabel } from "@/lib/payment-terms";
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

  const companyInfoLines = [
    identity.city && identity.country ? `${identity.city}, ${identity.country}` : null,
    identity.ice ? `ICE : ${identity.ice}` : null,
    identity.rc && identity.ifNumber
      ? `RC : ${identity.rc} - IF : ${identity.ifNumber}`
      : identity.rc
        ? `RC : ${identity.rc}`
        : identity.ifNumber
          ? `IF : ${identity.ifNumber}`
          : null,
  ].filter(Boolean) as string[];

  const companyContact = [identity.email, identity.phone].filter(Boolean).join(" - ");

  return (
    <PrintPage>
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
        <PrintDocumentTitle title="FACTURE" documentNumber={invoice.invoice_number}>
          <p><strong>Date :</strong> {formatDate(invoice.invoice_date)}</p>
          <p><strong>Échéance :</strong> {invoice.due_date ? formatDate(invoice.due_date) : "-"}</p>
          <p><strong>Conditions :</strong> {getPaymentTermLabel(invoice.payment_terms) || (invoice.payment_terms_days ? `${invoice.payment_terms_days} jours` : "-")}</p>
          <p><strong>Modalité :</strong> {getPaymentMethodLabel(invoice.payment_method) || "-"}</p>
          <p><strong>Statut :</strong> {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</p>
          <p><strong>Paiement :</strong> {INVOICE_PAYMENT_STATUS_LABELS[invoice.payment_status] ?? invoice.payment_status}</p>
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard title="Client" lines={clientLines} />

      <PrintLineTable
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
            <td className="num">{line.quantity}</td>
            <td>{line.unit_name ?? "-"}</td>
            <td className="num">{formatMoney(line.unit_price_ht)}</td>
            {discountPresent ? <td className="num">{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</td> : null}
            <td className="num">
              {line.tax_rate_id ? `${line.tax_rate}%` : "-"}
            </td>
            <td className="num">{formatMoney(line.subtotal_ht)}</td>
            <td className="num strong">{formatMoney(line.total_ttc)}</td>
          </tr>
        ))}
      </PrintLineTable>

      <PrintTotals
        rows={[
          { label: "Total HT", value: formatMoney(invoice.subtotal_ht) },
          { label: "Total TVA", value: formatMoney(invoice.tax_total) },
          { label: "Montant payé", value: formatMoney(invoice.paid_amount) },
          { label: "Reste à payer", value: formatMoney(invoice.remaining_amount) },
        ]}
        grandTotalLabel="Total TTC"
        grandTotalValue={formatMoney(invoice.total_ttc)}
      />

      {invoice.notes ? <PrintTerms title="Notes">{invoice.notes}</PrintTerms> : null}

      <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
