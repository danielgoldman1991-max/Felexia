import { notFound } from "next/navigation";
import { getActiveWorkspace } from "@/lib/auth";
import { getAccountingJournalDetail, listAccountingJournalEntries } from "@/lib/accounting";
import { formatDate } from "@/lib/format";
import { MoneyDisplay } from "@/components/erp/money-display";
import { ACCOUNTING_SOURCE_LABELS } from "@/components/accounting/accounting-source-badge";
import { ENTRY_STATUS_LABELS } from "@/lib/accounting-types";
import type { AccountingJournalEntryFilters } from "@/lib/accounting-types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(params: Record<string, string | string[] | undefined>, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function filtersFromParams(params: Record<string, string | string[] | undefined>): AccountingJournalEntryFilters {
  return {
    date_from: value(params, "date_from"),
    date_to: value(params, "date_to"),
    status: value(params, "status"),
    source_type: value(params, "source_type"),
    account_id: value(params, "account_id"),
    third_party_id: value(params, "third_party_id"),
    q: value(params, "q"),
    pageSize: 10000,
  };
}

export default async function AccountingJournalPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const filters = filtersFromParams(await searchParams);
  const [workspace, detail, list] = await Promise.all([
    getActiveWorkspace(),
    getAccountingJournalDetail(id),
    listAccountingJournalEntries(id, filters),
  ]);
  if (!detail.journal) notFound();

  return (
    <main className="min-h-screen bg-white p-8 text-slate-950 print:p-0">
      <style>{`
        @page { size: A4 landscape; margin: 12mm; }
        @media print { .no-print { display: none; } body { background: white; } }
      `}</style>
      <div className="no-print mb-6 flex justify-end">
        <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={undefined}>Utilisez Ctrl+P pour imprimer</button>
      </div>
      <header className="mb-6 border-b border-slate-300 pb-4">
        <p className="text-sm text-slate-500">{workspace?.organization.name ?? "Felexia"}</p>
        <h1 className="mt-1 text-2xl font-semibold">Journal {detail.journal.code} - {detail.journal.name}</h1>
        <p className="mt-2 text-sm text-slate-600">Imprime le {formatDate(new Date().toISOString())}</p>
        <p className="text-sm text-slate-600">Periode : {filters.date_from ?? "debut"} au {filters.date_to ?? "fin"}</p>
      </header>
      <section className="mb-4 grid grid-cols-3 gap-4 text-sm">
        <div><span className="text-slate-500">Ecritures :</span> {list.stats.entries_count}</div>
        <div><span className="text-slate-500">Total debit :</span> <MoneyDisplay value={list.stats.total_debit} /></div>
        <div><span className="text-slate-500">Total credit :</span> <MoneyDisplay value={list.stats.total_credit} /></div>
      </section>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 p-2 text-left">Date</th>
            <th className="border border-slate-300 p-2 text-left">N ecriture</th>
            <th className="border border-slate-300 p-2 text-left">Source</th>
            <th className="border border-slate-300 p-2 text-left">Libelle</th>
            <th className="border border-slate-300 p-2 text-right">Debit</th>
            <th className="border border-slate-300 p-2 text-right">Credit</th>
            <th className="border border-slate-300 p-2 text-left">Statut</th>
          </tr>
        </thead>
        <tbody>
          {list.entries.map((entry) => (
            <tr key={entry.id}>
              <td className="border border-slate-300 p-2">{formatDate(entry.entry_date)}</td>
              <td className="border border-slate-300 p-2">{entry.entry_number}</td>
              <td className="border border-slate-300 p-2">{ACCOUNTING_SOURCE_LABELS[entry.source_document_type ?? "manual"] ?? entry.source_document_type ?? "Manuel"} {entry.source_number ?? ""}</td>
              <td className="border border-slate-300 p-2">{entry.label}</td>
              <td className="border border-slate-300 p-2 text-right"><MoneyDisplay value={entry.total_debit} /></td>
              <td className="border border-slate-300 p-2 text-right"><MoneyDisplay value={entry.total_credit} /></td>
              <td className="border border-slate-300 p-2">{ENTRY_STATUS_LABELS[entry.status] ?? entry.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-10 grid grid-cols-2 gap-16 text-sm">
        <div className="border-t border-slate-400 pt-2">Signature</div>
        <div className="border-t border-slate-400 pt-2">Cachet</div>
      </footer>
    </main>
  );
}
