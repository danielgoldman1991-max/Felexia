import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AccountingJournalEntriesTable } from "@/components/accounting/accounting-journal-entries-table";
import { AccountingJournalFilters } from "@/components/accounting/accounting-journal-filters";
import { AccountingJournalSummaryCards } from "@/components/accounting/accounting-journal-summary-cards";
import { getAccountingJournalDetail, listAccountingJournalEntries, listActiveChartOfAccounts } from "@/lib/accounting";
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
    page: Number(value(params, "page") ?? 1),
    pageSize: 50,
  };
}

function queryString(params: Record<string, string | string[] | undefined>) {
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const val = Array.isArray(raw) ? raw[0] : raw;
    if (val) search.set(key, val);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function periodLabel(filters: AccountingJournalEntryFilters) {
  if (filters.date_from && filters.date_to) return `${filters.date_from} au ${filters.date_to}`;
  if (filters.date_from) return `Depuis ${filters.date_from}`;
  if (filters.date_to) return `Jusqu'au ${filters.date_to}`;
  return "Toutes periodes";
}

export default async function AccountingJournalDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const rawParams = await searchParams;
  const filters = filtersFromParams(rawParams);
  const [detail, list, accounts] = await Promise.all([
    getAccountingJournalDetail(id),
    listAccountingJournalEntries(id, filters),
    listActiveChartOfAccounts(),
  ]);
  if (!detail.journal) notFound();
  const qs = queryString(rawParams);

  return (
    <ModulePage>
      <PageHeader
        title={`Journal ${detail.journal.code} - ${detail.journal.name}`}
        description="Detail des ecritures comptables du journal."
        actions={(
          <>
            <Link href="/comptabilite/journaux"><Button type="button" variant="secondary"><ArrowLeft className="h-4 w-4" /> Retour</Button></Link>
            <Link href={`/comptabilite/journaux/${id}/print${qs}`} target="_blank"><Button type="button" variant="secondary"><Printer className="h-4 w-4" /> Imprimer</Button></Link>
            <Link href={`/comptabilite/journaux/${id}/export${qs}`}><Button type="button" variant="secondary"><Download className="h-4 w-4" /> Export Excel</Button></Link>
          </>
        )}
      />
      <div className="space-y-6">
        <AccountingJournalFilters journalId={id} filters={filters} accounts={accounts} />
        <AccountingJournalSummaryCards entriesCount={list.stats.entries_count} totalDebit={list.stats.total_debit} totalCredit={list.stats.total_credit} periodLabel={periodLabel(filters)} />
        <Card>
          <CardContent>
            <AccountingJournalEntriesTable entries={list.entries} />
          </CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}
