import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { TreasuryConsultationFilters } from "@/components/treasury/treasury-consultation-filters";
import { TreasuryConsultationSummaryCards } from "@/components/treasury/treasury-consultation-summary-cards";
import { TreasuryConsultationTable } from "@/components/treasury/treasury-consultation-table";
import { listTreasuryAccounts, listTreasuryConsultationFlows } from "@/lib/treasury";
import type { TreasuryConsultationFilters as Filters } from "@/lib/treasury-types";

export const dynamic = "force-dynamic";

function parseFilters(sp: URLSearchParams): Filters {
  return {
    date_from: sp.get("date_from") || undefined,
    date_to: sp.get("date_to") || undefined,
    treasury_account_id: sp.get("treasury_account_id") || undefined,
    account_type: sp.get("account_type") || undefined,
    direction: sp.get("direction") || undefined,
    transaction_type: sp.get("transaction_type") || undefined,
    reconciliation_status: sp.get("reconciliation_status") || undefined,
    accounting_status: sp.get("accounting_status") || undefined,
    third_party_id: sp.get("third_party_id") || undefined,
    payment_method: sp.get("payment_method") || undefined,
    q: sp.get("q") || undefined,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: 50,
  };
}

function href(page: number, sp: URLSearchParams) {
  const next = new URLSearchParams(sp);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const qs = next.toString();
  return `/tresorerie/consultation${qs ? `?${qs}` : ""}`;
}

export default async function TreasuryConsultationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) { for (const v of value) sp.append(key, v); }
    else if (value !== undefined) sp.set(key, value);
  }
  const filters = parseFilters(sp);
  const [accounts, result] = await Promise.all([
    listTreasuryAccounts(),
    listTreasuryConsultationFlows(filters),
  ]);

  const csvUrl = "";

  return (
    <ModulePage>
      <PageHeader title="Consultation tresorerie" description="Vue complete, filtrable et tracable des flux avant/apres comptabilisation." actions={
        <div className="flex items-center gap-2">
          <Link href={csvUrl || "#"}>
            <Button variant="secondary" disabled={!csvUrl}><Download className="h-4 w-4" /> Exporter</Button>
          </Link>
        </div>
      } />
      <TreasuryConsultationFilters accounts={accounts} />
      <TreasuryConsultationSummaryCards summary={result.summary} />
      <TreasuryConsultationTable rows={result.rows} />
      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">
            Page {result.page} sur {result.totalPages} ({result.total} resultats)
          </p>
          <div className="flex items-center gap-2">
            {result.page > 1 ? (
              <Link href={href(result.page - 1, sp)}>
                <Button variant="secondary"><ChevronLeft className="h-4 w-4" /> Precedente</Button>
              </Link>
            ) : null}
            {result.page < result.totalPages ? (
              <Link href={href(result.page + 1, sp)}>
                <Button variant="secondary">Suivante <ChevronRight className="h-4 w-4" /></Button>
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </ModulePage>
  );
}