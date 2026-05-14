import Image from "next/image";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { hasDiscount, SALES_STATUS_LABELS } from "@/lib/sales-types";
import type { SalesDocumentLineRecord, SalesDocumentRecord } from "@/lib/sales-types";
import type { OrganizationIdentity } from "@/lib/company-identity";

function ClientBlock({ document }: { document: SalesDocumentRecord }) {
  const clientLines = [
    document.customer_name,
    document.customer_address,
    document.customer_city,
    document.customer_phone ? `Tel. : ${document.customer_phone}` : null,
    document.customer_email ? `Email : ${document.customer_email}` : null,
    document.customer_ice ? `ICE : ${document.customer_ice}` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-slate-200 p-5">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[#2d2490]">Client</h2>
      <div className="mt-4 space-y-1.5 text-sm leading-6 text-slate-800">
        {clientLines.length > 0 ? (
          clientLines.map((line) => (
            <p key={line}>{line}</p>
          ))
        ) : (
          <p>-</p>
        )}
      </div>
    </div>
  );
}

function deliveryRemainingQuantity(line: SalesDocumentLineRecord) {
  return line.remaining_quantity ?? null;
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
    identity.rc && identity.ifNumber ? `RC : ${identity.rc} - IF : ${identity.ifNumber}` : identity.rc ? `RC : ${identity.rc}` : identity.ifNumber ? `IF : ${identity.ifNumber}` : null,
  ].filter(Boolean);

  const companyContact = [
    identity.email,
    identity.phone,
    identity.website,
  ].filter(Boolean).join(" - ");

  return (
    <main className="mx-auto min-h-[297mm] max-w-[210mm] bg-white px-12 py-10 text-slate-900 shadow-[0_18px_60px_rgb(15_23_42_/_12%)] print:min-h-0 print:max-w-none print:shadow-none">
      <header className="flex items-start justify-between gap-8 border-b-2 border-[#2d2490] pb-8">
        <div className="flex max-w-[55%] items-start gap-4">
          {identity.logoUrl ? (
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Image src={identity.logoUrl} alt="Logo" fill className="object-contain p-1" priority />
            </div>
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
              <span className="text-2xl font-bold text-[#2d2490]">{identity.name.charAt(0)}</span>
            </div>
          )}
          <div>
            <p className="text-xl font-bold text-[#2d2490]">{identity.name || "Mon Entreprise"}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {companyInfoLines.length
                ? companyInfoLines.map((line, i) => (
                    <span key={i}>{line}{i < companyInfoLines.length - 1 && <br />}</span>
                  ))
                : "-"}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-4xl font-bold tracking-wide text-[#2d2490]">{title}</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">{document.document_number}</p>
          <div className="mt-4 space-y-1 text-sm text-slate-600">
            <p>Date : {formatDate(document.document_date)}</p>
            {document.document_type === "quote" ? (
              <p>Validite : {document.valid_until ? formatDate(document.valid_until) : "-"}</p>
            ) : null}
            {document.document_type === "order" ? (
              <p>Livraison prevue : {document.expected_delivery_date ? formatDate(document.expected_delivery_date) : "-"}</p>
            ) : null}
            {document.related_order_number ? <p>Commande : {document.related_order_number}</p> : null}
            {document.related_delivery_number ? <p>BL : {document.related_delivery_number}</p> : null}
            <p>Statut : {SALES_STATUS_LABELS[document.status] ?? document.status}</p>
          </div>
        </div>
      </header>

      <section className="mt-8 max-w-[95mm]">
        <ClientBlock document={document} />
      </section>

      <section className="mt-8">
        <table className="w-full border-collapse text-left text-xs">
          {isDelivery ? (
            <thead>
              <tr className="bg-[#ede7ff] text-[#2d2490]">
                <th className="border border-slate-200 px-3 py-2">#</th>
                <th className="border border-slate-200 px-3 py-2">Reference / Article</th>
                <th className="border border-slate-200 px-3 py-2">Designation</th>
                <th className="border border-slate-200 px-3 py-2">Unite</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Quantite livree</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Reste a livrer</th>
              </tr>
            </thead>
          ) : isReturn ? (
            <thead>
              <tr className="bg-[#ede7ff] text-[#2d2490]">
                <th className="border border-slate-200 px-3 py-2">#</th>
                <th className="border border-slate-200 px-3 py-2">Reference / Article</th>
                <th className="border border-slate-200 px-3 py-2">Designation</th>
                <th className="border border-slate-200 px-3 py-2">Unite</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Quantite retournee</th>
              </tr>
            </thead>
          ) : (
            <thead>
              <tr className="bg-[#ede7ff] text-[#2d2490]">
                <th className="border border-slate-200 px-3 py-2">#</th>
                <th className="border border-slate-200 px-3 py-2">Designation</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Quantite</th>
                <th className="border border-slate-200 px-3 py-2">Unite</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Prix HT</th>
                {discountPresent ? <th className="border border-slate-200 px-3 py-2 text-right">Remise</th> : null}
                <th className="border border-slate-200 px-3 py-2 text-right">TVA</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Total HT</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Total TTC</th>
              </tr>
            </thead>
          )}
          <tbody>
            {lines.map((line, index) => {
              const remaining = deliveryRemainingQuantity(line);

              return isDelivery ? (
                <tr key={line.id} className="align-top">
                  <td className="border border-slate-200 px-3 py-3">{index + 1}</td>
                  <td className="border border-slate-200 px-3 py-3">{line.product_name || "Ligne libre"}</td>
                  <td className="border border-slate-200 px-3 py-3">{line.description}</td>
                  <td className="border border-slate-200 px-3 py-3">{line.unit_name ?? "-"}</td>
                  <td className="border border-slate-200 px-3 py-3 text-right font-semibold">{formatNumber(line.quantity)}</td>
                  <td className="border border-slate-200 px-3 py-3 text-right">
                    {remaining === null ? "-" : remaining <= 0 ? "Livre totalement" : formatNumber(remaining)}
                  </td>
                </tr>
              ) : isReturn ? (
                <tr key={line.id} className="align-top">
                  <td className="border border-slate-200 px-3 py-3">{index + 1}</td>
                  <td className="border border-slate-200 px-3 py-3">{line.product_name || "Ligne libre"}</td>
                  <td className="border border-slate-200 px-3 py-3">{line.description}</td>
                  <td className="border border-slate-200 px-3 py-3">{line.unit_name ?? "-"}</td>
                  <td className="border border-slate-200 px-3 py-3 text-right font-semibold">{formatNumber(line.quantity)}</td>
                </tr>
              ) : (
                <tr key={line.id} className="align-top">
                  <td className="border border-slate-200 px-3 py-3">{index + 1}</td>
                  <td className="border border-slate-200 px-3 py-3">
                    <p className="font-medium text-slate-900">{line.description}</p>
                    {line.product_name ? <p className="mt-1 text-[11px] text-slate-500">{line.product_name}</p> : null}
                  </td>
                  <td className="border border-slate-200 px-3 py-3 text-right">{line.quantity}</td>
                  <td className="border border-slate-200 px-3 py-3">{line.unit_name ?? "-"}</td>
                  <td className="border border-slate-200 px-3 py-3 text-right">{formatMoney(line.unit_price_ht)}</td>
                  {discountPresent ? <td className="border border-slate-200 px-3 py-3 text-right">{line.discount_rate > 0 ? `${line.discount_rate}%` : "-"}</td> : null}
                  <td className="border border-slate-200 px-3 py-3 text-right">{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</td>
                  <td className="border border-slate-200 px-3 py-3 text-right">{formatMoney(line.subtotal_ht)}</td>
                  <td className="border border-slate-200 px-3 py-3 text-right font-semibold">{formatMoney(line.total_ttc)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {!isLogisticsDocument ? (
        <section className="mt-8 flex justify-end">
          <div className="w-72 rounded-lg border border-slate-200">
            <div className="flex justify-between border-b border-slate-200 px-4 py-3 text-sm">
              <span>Total HT</span>
              <span>{formatMoney(document.subtotal_ht)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 px-4 py-3 text-sm">
              <span>Total TVA</span>
              <span>{formatMoney(document.tax_total)}</span>
            </div>
            <div className="flex justify-between rounded-b-lg bg-[#2d2490] px-4 py-4 text-base font-bold text-white">
              <span>Total TTC</span>
              <span>{formatMoney(document.total_ttc)}</span>
            </div>
          </div>
        </section>
      ) : null}

      {document.notes ? (
        <section className="mt-8 rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#2d2490]">Notes et observations</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{document.notes}</p>
        </section>
      ) : null}

      {document.return_reason ? (
        <section className="mt-8 rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#2d2490]">Motif de retour</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{document.return_reason}</p>
          {document.internal_notes ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{document.internal_notes}</p>
          ) : null}
        </section>
      ) : null}

      {showSignature ? (
        <section className="mt-10 flex justify-end">
          <div className="h-28 w-64 rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            Signature et cachet du client
          </div>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs leading-5 text-slate-500">
        <p className="font-semibold text-slate-700">{identity.footerText || "Merci pour votre confiance."}</p>
        {companyContact && <p>{identity.name} - {companyContact}</p>}
      </footer>
    </main>
  );
}
