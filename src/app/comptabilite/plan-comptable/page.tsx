import Link from "next/link";
import { Plus, Download, Database } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { AccountsTable, ChartOfAccountFilters, PaginationBar } from "@/components/accounting/accounts-table";
import { ensureAccountingBaseSetup, listChartOfAccounts } from "@/lib/accounting";
import { requireActiveWorkspace } from "@/lib/auth";
import type { ChartOfAccountFilters as Filters } from "@/lib/accounting-types";

export const dynamic = "force-dynamic";

function parseFilters(sp: URLSearchParams): Filters {
  const isAux = sp.get("is_auxiliary");
  return {
    q: sp.get("q") || undefined,
    account_class: sp.get("account_class") || undefined,
    account_type: sp.get("account_type") || undefined,
    is_auxiliary: isAux ? isAux === "1" : undefined,
    is_active: sp.get("is_active") || undefined,
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: 50,
  };
}

export default async function ChartOfAccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const workspace = await requireActiveWorkspace();
  await ensureAccountingBaseSetup(workspace.organization.id);

  const params = await searchParams;
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) { for (const v of value) sp.append(key, v); }
    else if (value !== undefined) sp.set(key, value);
  }
  const filters = parseFilters(sp);
  const result = await listChartOfAccounts(filters);

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) { for (const item of v) exportParams.append(k, item); }
    else if (v !== undefined) exportParams.set(k, v);
  }
  const exportHref = `/comptabilite/plan-comptable/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  return (
    <ModulePage>
      <PageHeader
        title="Plan comptable"
        description="Structure des comptes comptables de l'organisation."
        actions={
          <div className="flex items-center gap-2">
            <Link href={exportHref}>
              <Button variant="secondary"><Download className="h-4 w-4" /> Exporter</Button>
            </Link>
            <form action="/comptabilite/plan-comptable/init" method="POST">
              <Button variant="secondary" type="submit"><Database className="h-4 w-4" /> Initialiser</Button>
            </form>
            <Link href="/comptabilite/plan-comptable/new">
              <Button variant="primary"><Plus className="h-4 w-4" /> Nouveau compte</Button>
            </Link>
          </div>
        }
      />
      <ChartOfAccountFilters total={result.total} />
      <AccountsTable rows={result.rows} />
      <PaginationBar page={result.page} totalPages={result.totalPages} total={result.total} />
    </ModulePage>
  );
}
