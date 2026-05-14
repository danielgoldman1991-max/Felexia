import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { MoneyDisplay } from "@/components/erp/money-display";
import { getCustomerPaymentDetail } from "@/lib/payments";
import { formatDate } from "@/lib/format";
import { getPaymentMethodLabel } from "@/lib/payment-terms";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { requireActiveWorkspace } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerPaymentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { payment, allocations } = await getCustomerPaymentDetail(id);
  if (!payment) notFound();
  const workspace = await requireActiveWorkspace();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <PrintActions backHref={`/facturation/paiements/${payment.id}`} backLabel="Retour paiement" />
      <section className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-10 text-slate-900 shadow print:min-h-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div><h1 className="text-2xl font-bold">RECU DE PAIEMENT</h1><p className="mt-2 text-sm text-slate-500">{identity.name || "Mon Entreprise"}</p></div>
          <div className="text-right text-sm"><p className="font-semibold">{payment.payment_number}</p><p>{formatDate(payment.payment_date)}</p></div>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div><h2 className="font-semibold">Client</h2><p className="mt-2">{payment.customer_name}</p></div>
          <div className="space-y-1 text-sm">
            <p>Modalite : {getPaymentMethodLabel(payment.payment_method) ?? payment.payment_method}</p>
            <p>Montant : <MoneyDisplay value={payment.amount} /></p>
            <p>Affecte : <MoneyDisplay value={payment.allocated_amount} /></p>
            <p>Disponible : <MoneyDisplay value={payment.available_amount} /></p>
            <p>Reference : {payment.reference ?? payment.transfer_reference ?? payment.check_number ?? "-"}</p>
          </div>
        </div>
        <h2 className="mt-10 font-semibold">Factures affectees</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead><tr className="bg-slate-100"><th className="p-2 text-left">Facture</th><th className="p-2 text-left">Date</th><th className="p-2 text-right">Montant</th></tr></thead>
          <tbody>{allocations.map((allocation) => <tr key={allocation.id} className="border-b"><td className="p-2">{allocation.invoice_number}</td><td className="p-2">{formatDate(allocation.allocation_date)}</td><td className="p-2 text-right"><MoneyDisplay value={allocation.amount} /></td></tr>)}</tbody>
        </table>
        <div className="mt-16 flex justify-end"><div className="w-64 border-t border-slate-400 pt-3 text-center text-sm">Signature et cachet</div></div>
      </section>
    </main>
  );
}
