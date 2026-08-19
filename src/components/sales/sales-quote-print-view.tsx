import { formatDate, formatMoney, formatNumber } from "@/lib/format";
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

  const companyInfoLines = [
    identity.city && identity.country ? `${identity.city}, ${identity.country}` : null,
    identity.address && !identity.city ? identity.address : null,
    identity.ice ? `ICE : ${identity.ice}` : null,
    identity.rc && identity.ifNumber
      ? `RC : ${identity.rc} - IF : ${identity.ifNumber}`
      : identity.rc
        ? `RC : ${identity.rc}`
        : identity.ifNumber
          ? `IF : ${identity.ifNumber}`
          : null,
  ].filter(Boolean) as string[];

  const companyContact = [identity.email, identity.phone, identity.website].filter(Boolean).join(" - ");

  return (
    <PrintPage>
      <PrintHeader>
        <PrintOrganizationIdentity identity={identity} infoLines={companyInfoLines} contact={companyContact} />
        <PrintDocumentTitle title={title} documentNumber={document.document_number}>
          <p><strong>Date :</strong> {formatDate(document.document_date)}</p>
          {document.document_type === "quote" ? (
            <p><strong>Validité :</strong> {document.valid_until ? formatDate(document.valid_until) : "-"}</p>
          ) : null}
          {document.document_type === "order" ? (
            <p><strong>Livraison prévue :</strong> {document.expected_delivery_date ? formatDate(document.expected_delivery_date) : "-"}</p>
          ) : null}
          {document.related_order_number ? <p><strong>Commande :</strong> {document.related_order_number}</p> : null}
          {document.related_delivery_number ? <p><strong>BL :</strong> {document.related_delivery_number}</p> : null}
          <p><strong>Statut :</strong> {SALES_STATUS_LABELS[document.status] ?? document.status}</p>
        </PrintDocumentTitle>
      </PrintHeader>

      <PrintPartyCard title="Client" lines={clientLines(document)} />

      <PrintLineTable
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
              <td className="num">{line.quantity}</td>
              <td>{line.unit_name ?? "-"}</td>
              <td className="num">{formatMoney(line.unit_price_ht)}</td>
              {discountPresent ? <td className="num">{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</td> : null}
              <td className="num">
                {line.tax_rate_id ? (line.tax_rate_name || `${line.tax_rate}%`) : "-"}
              </td>
              <td className="num">{formatMoney(line.subtotal_ht)}</td>
              <td className="num strong">{formatMoney(line.total_ttc)}</td>
            </tr>
          );
        })}
      </PrintLineTable>

      {!isLogisticsDocument ? (
        <PrintTotals
          rows={[
            { label: "Total HT", value: formatMoney(document.subtotal_ht) },
            { label: "Total TVA", value: formatMoney(document.tax_total) },
          ]}
          grandTotalLabel="Total TTC"
          grandTotalValue={formatMoney(document.total_ttc)}
        />
      ) : null}

      {document.notes ? <PrintTerms title="Notes et observations">{document.notes}</PrintTerms> : null}

      {document.return_reason ? (
        <PrintTerms title="Motif de retour">
          {document.return_reason}
          {document.internal_notes ? <span className="muted"> — {document.internal_notes}</span> : null}
        </PrintTerms>
      ) : null}

      {showSignature ? <PrintSignature /> : null}

      <PrintFooter footerText={identity.footerText || "Merci pour votre confiance."} name={identity.name} contact={companyContact} />
    </PrintPage>
  );
}
