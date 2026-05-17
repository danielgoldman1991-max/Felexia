import { formatDate, formatNumber } from "@/lib/format";
import type { PurchaseDocumentLineRecord, PurchaseDocumentRecord } from "@/lib/purchase-types";
import type { OrganizationIdentity } from "@/lib/company-identity";
import { PrintOrganizationLogo } from "@/components/shared/print-organization-logo";

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
  ].filter(Boolean);

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
          <p className="text-3xl font-bold tracking-wide text-[#2d2490]">BON DE RECEPTION</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">{document.document_number}</p>
          <div className="mt-4 space-y-1 text-sm text-slate-600">
            <p>Date : {formatDate(document.receipt_date ?? document.document_date)}</p>
            {document.related_order_number ? <p>Commande : {document.related_order_number}</p> : null}
          </div>
        </div>
      </header>

      <section className="mt-8 max-w-[95mm]">
        <div className="rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#2d2490]">Fournisseur</h2>
          <div className="mt-4 space-y-1.5 text-sm leading-6 text-slate-800">
            <p className="font-semibold">{document.supplier_name}</p>
            {document.warehouse_name ? <p className="text-xs text-slate-500 mt-1">Emplacement : {document.warehouse_name}</p> : null}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-[#ede7ff] text-[#2d2490]">
              <th className="border border-slate-200 px-3 py-2">#</th>
              <th className="border border-slate-200 px-3 py-2">Article</th>
              <th className="border border-slate-200 px-3 py-2">Designation</th>
              <th className="border border-slate-200 px-3 py-2">Unite</th>
              <th className="border border-slate-200 px-3 py-2 text-right">Quantite recue</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.id} className="align-top">
                <td className="border border-slate-200 px-3 py-3">{i + 1}</td>
                <td className="border border-slate-200 px-3 py-3">{line.product_name || "Ligne libre"}</td>
                <td className="border border-slate-200 px-3 py-3">{line.description}</td>
                <td className="border border-slate-200 px-3 py-3">{line.unit_name ?? "-"}</td>
                <td className="border border-slate-200 px-3 py-3 text-right font-semibold">{formatNumber(line.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-12">
        <div className="grid grid-cols-2 gap-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#2d2490]">Receptionne par</p>
            <div className="mt-2 h-12 border-b border-slate-300" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#2d2490]">Controle par</p>
            <div className="mt-2 h-12 border-b border-slate-300" />
          </div>
        </div>
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs leading-5 text-slate-500">
        <p className="font-semibold text-slate-700">Bon de reception fournisseur - Document logistique</p>
        {identity.name && <p>{identity.name}{identity.city ? ` - ${identity.city}${identity.country ? `, ${identity.country}` : ""}` : ""}</p>}
      </footer>
    </main>
  );
}
