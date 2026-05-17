import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { SupplierInvoiceLineRecord, SupplierInvoiceRecord } from "@/lib/purchase-types";
import type { OrganizationIdentity } from "@/lib/company-identity";
import { PrintOrganizationLogo } from "@/components/shared/print-organization-logo";

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
  ].filter(Boolean);

  const companyContact = [identity.email, identity.phone].filter(Boolean).join(" - ");

  return (
    <main className="mx-auto min-h-[297mm] max-w-[210mm] bg-white px-12 py-10 text-slate-900 shadow-[0_18px_60px_rgb(15_23_42_/_12%)] print:min-h-0 print:max-w-none print:shadow-none">
      <header className="flex items-start justify-between gap-8 border-b-2 border-[#2d2490] pb-8">
        <div className="flex max-w-[55%] items-start gap-4">
          <PrintOrganizationLogo identity={identity} />
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
          <p className="text-4xl font-bold tracking-wide text-[#2d2490]">FACTURE FOURNISSEUR</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">{invoice.invoice_number}</p>
          <div className="mt-4 space-y-1 text-sm text-slate-600">
            <p>Date : {formatDate(invoice.invoice_date)}</p>
            {invoice.due_date ? <p>Echeance : {formatDate(invoice.due_date)}</p> : null}
            {invoice.supplier_invoice_number ? <p>N facture fournisseur : {invoice.supplier_invoice_number}</p> : null}
          </div>
        </div>
      </header>

      <section className="mt-8 max-w-[95mm]">
        <div className="rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#2d2490]">Fournisseur</h2>
          <div className="mt-4 space-y-1.5 text-sm leading-6 text-slate-800">
            <p className="font-semibold">{invoice.supplier_name}</p>
            {invoice.supplier_ice ? <p>ICE : {invoice.supplier_ice}</p> : null}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-[#ede7ff] text-[#2d2490]">
              <th className="border border-slate-200 px-3 py-2">#</th>
              <th className="border border-slate-200 px-3 py-2">Designation</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Quantite</th>
              <th className="border border-slate-200 px-3 py-2">Unite</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Prix HT</th>
              <th className="border border-slate-200 px-3 py-2 text-right">TVA</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Total HT</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.id} className="align-top">
                <td className="border border-slate-200 px-3 py-3">{i + 1}</td>
                <td className="border border-slate-200 px-3 py-3">
                  <p className="font-medium text-slate-900">{line.description}</p>
                  {line.product_name ? <p className="mt-1 text-[11px] text-slate-500">{line.product_name}</p> : null}
                </td>
                <td className="border border-slate-200 px-3 py-3 text-right">{formatNumber(line.quantity)}</td>
                <td className="border border-slate-200 px-3 py-3">{line.unit_name ?? "-"}</td>
                <td className="border border-slate-200 px-3 py-3 text-right">{formatMoney(line.unit_price_ht)}</td>
                <td className="border border-slate-200 px-3 py-3 text-right">{line.tax_rate > 0 ? `${line.tax_rate}%` : "-"}</td>
                <td className="border border-slate-200 px-3 py-3 text-right">{formatMoney(line.subtotal_ht)}</td>
                <td className="border border-slate-200 px-3 py-3 text-right font-semibold">{formatMoney(line.total_ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 flex justify-end">
        <div className="w-72 rounded-lg border border-slate-200">
          <div className="flex justify-between border-b border-slate-200 px-4 py-3 text-sm">
            <span>Total HT</span><span>{formatMoney(invoice.subtotal_ht)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 px-4 py-3 text-sm">
            <span>Total TVA</span><span>{formatMoney(invoice.tax_total)}</span>
          </div>
          <div className="flex justify-between rounded-b-lg bg-[#2d2490] px-4 py-4 text-base font-bold text-white">
            <span>Total TTC</span><span>{formatMoney(invoice.total_ttc)}</span>
          </div>
        </div>
      </section>

      {invoice.notes ? (
        <section className="mt-8 rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#2d2490]">Notes</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{invoice.notes}</p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs leading-5 text-slate-500">
        <p className="font-semibold text-slate-700">{identity.footerText || "Merci pour votre confiance."}</p>
        {companyContact && <p>{identity.name} - {companyContact}</p>}
      </footer>
    </main>
  );
}
