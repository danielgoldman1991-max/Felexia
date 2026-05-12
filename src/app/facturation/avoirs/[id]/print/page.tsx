import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { getCustomerCreditNoteDetail } from "@/lib/credit-notes";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CreditNotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { creditNote, lines } = await getCustomerCreditNoteDetail(id);
  if (!creditNote) notFound();
  return (
    <main className="mx-auto max-w-5xl bg-white p-8 print:p-0">
      <PrintActions backHref={`/facturation/avoirs/${creditNote.id}`} backLabel="Retour avoir" />
      <h1 className="text-2xl font-bold">AVOIR CLIENT</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div><p className="text-sm text-[var(--muted)]">Client</p><p className="font-semibold">{creditNote.customer_name}</p></div>
        <div className="text-right">
          <p>{creditNote.credit_note_number}</p>
          <p>{formatDate(creditNote.credit_note_date)}</p>
          {creditNote.source_return_number ? <p>Origine : Bon de retour {creditNote.source_return_number}</p> : null}
          {creditNote.source_invoice_number ? <p>Facture source : {creditNote.source_invoice_number}</p> : null}
        </div>
      </div>
      <div className="mt-6"><Table><thead><tr><Th>#</Th><Th>Designation</Th><Th>Quantite</Th><Th>Prix HT</Th><Th>TVA</Th><Th>Total TTC</Th></tr></thead><tbody>{lines.map((line, index) => <tr key={line.id}><Td>{index + 1}</Td><Td>{line.description}</Td><Td>{line.quantity}</Td><Td><MoneyDisplay value={line.unit_price_ht} /></Td><Td>{line.tax_rate}%</Td><Td><MoneyDisplay value={line.total_ttc} /></Td></tr>)}</tbody></Table></div>
      <div className="mt-6 grid gap-2 text-right"><p>Total HT : <MoneyDisplay value={creditNote.subtotal_ht} /></p><p>TVA : <MoneyDisplay value={creditNote.tax_total} /></p><p className="text-lg font-semibold">Total TTC : <MoneyDisplay value={creditNote.total_ttc} /></p><p>Disponible : <MoneyDisplay value={creditNote.available_amount} /></p></div>
      {creditNote.reason ? <p className="mt-6 text-sm">Motif : {creditNote.reason}</p> : null}
    </main>
  );
}
