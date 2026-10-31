import { documentIdentityInfoLines, documentIdentityContact, documentTaxSummary, formatDocumentMoney, formatDocumentNumber } from "@/lib/print-format";
import { formatDate, formatNumber } from "@/lib/format";
import { hasDiscount, SALES_STATUS_LABELS } from "@/lib/sales-types";
import type { SalesDocumentLineRecord, SalesDocumentRecord } from "@/lib/sales-types";
import type { OrganizationIdentity } from "@/lib/company-identity";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintPartyCard } from "@/components/print/PrintPartyCard";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintTotals } from "@/components/print/PrintTotals";
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintSignature } from "@/components/print/PrintSignature";
import { PrintFooter } from "@/components/print/PrintFooter";
import { PrintSummary } from "@/components/print/PrintSummary";
import { PrintTaxSummary } from "@/components/print/PrintTaxSummary";

function clientLines(document: SalesDocumentRecord) {
  return [
    document.customer_name,
    document.customer_address,
    document.customer_city,
    document.customer_phone ? `Tel. : ${document.customer_phone}` : null,
    document.customer_email ? `Email : ${document.customer_email}` : null,
    document.customer_ice ? `ICE : ${document.customer_ice}` : null,
  ].filter(Boolean) as string[];
}

export function SalesQuotePrintView({
  document,
  lines,
  identity,
  title = "DEVIS",
  showSignature = false,
}: {
  document: SalesDocumentRecord;
  lines: SalesDocumentLineRecord[];
  identity: OrganizationIdentity;
  title?: string;
  showSignature?: boolean;
}) {
  const isDelivery = document.document_type === "delivery_note";
  const isReturn = document.document_type === "return_note";
  const isLogisticsDocument = isDelivery || isReturn;
  const discountPresent = !isLogisticsDocument && hasDiscount(lines);

  const currency = identity.currency;
  const money = (value: number | null | undefined) => formatDocumentMoney(value, currency);
  const companyInfoLines = documentIdentityInfoLines(identity);

  const companyContact = documentIdentityContact(identity);

  return (
    <PrintPage>
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
        <PrintDocumentTitle title={title} documentNumber={document.document_number}>
          <p><strong>Date :</strong> {formatDate(document.document_date)}</p>
          {document.document_type === "quote" && document.valid_until ? (
            <p><strong>Validité :</strong> {formatDate(document.valid_until)}</p>
          ) : null}
          {document.document_type === "order" && document.expected_delivery_date ? (
            <p><strong>Livraison prévue :</strong> {formatDate(document.expected_delivery_date)}</p>
          ) : null}
          {document.related_order_number ? <p><strong>Commande :</strong> {document.related_order_number}</p> : null}
          {document.related_delivery_number ? <p><strong>BL :</strong> {document.related_delivery_number}</p> : null}
          <p><strong>Statut :</strong> {SALES_STATUS_LABELS[document.status] ?? document.status}</p>
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard title="Client" lines={clientLines(document)} />

      <PrintLineTable currency={!isLogisticsDocument ? currency : undefined}
        head={
          isDelivery ? (
            <>
              <th>#</th>
              <th>Référence / Article</th>
              <th>Désignation</th>
              <th>Unité</th>
              <th className="right">Quantité livrée</th>
              <th className="right">Reste à livrer</th>
            </>
          ) : isReturn ? (
            <>
              <th>#</th>
              <th>Référence / Article</th>
              <th>Désignation</th>
              <th>Unité</th>
              <th className="right">Quantité retournée</th>
            </>
          ) : (
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
          )
        }
      >
        {lines.map((line, index) => {
          const remaining = isDelivery ? (line.remaining_quantity ?? null) : null;

          return isDelivery ? (
            <tr key={line.id}>
              <td>{index + 1}</td>
              <td>{line.product_name || "Ligne libre"}</td>
              <td>{line.description}</td>
              <td>{line.unit_name ?? "-"}</td>
              <td className="num strong">{formatNumber(line.quantity)}</td>
              <td className="num">
                {remaining === null ? "-" : remaining <= 0 ? "Livré totalement" : formatNumber(remaining)}
              </td>
            </tr>
          ) : isReturn ? (
            <tr key={line.id}>
              <td>{index + 1}</td>
              <td>{line.product_name || "Ligne libre"}</td>
              <td>{line.description}</td>
              <td>{line.unit_name ?? "-"}</td>
              <td className="num strong">{formatNumber(line.quantity)}</td>
            </tr>
          ) : (
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
                {line.tax_rate_id ? (line.tax_rate_name || `${line.tax_rate}%`) : "-"}
              </td>
              <td className="num">{formatDocumentNumber(line.subtotal_ht)}</td>
              <td className="num strong">{formatDocumentNumber(line.total_ttc)}</td>
            </tr>
          );
        })}
      </PrintLineTable>

      {!isLogisticsDocument ? (
        <PrintSummary aside={<PrintTaxSummary rows={documentTaxSummary(lines, currency)} />}>
        <PrintTotals
          rows={[
            { label: "Total HT", value: money(document.subtotal_ht) },
            { label: "Total TVA", value: money(document.tax_total) },
          ]}
          grandTotalLabel="Total TTC"
          grandTotalValue={money(document.total_ttc)}
        />
        </PrintSummary>
      ) : null}

      {document.notes ? <PrintTerms title="Notes et observations">{document.notes}</PrintTerms> : null}

      {document.return_reason ? (
        <PrintTerms title="Motif de retour">
          {document.return_reason}
        </PrintTerms>
      ) : null}

      {showSignature ? <PrintSignature /> : null}

      <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
