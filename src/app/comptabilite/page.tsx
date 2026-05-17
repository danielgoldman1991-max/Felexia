import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { listAccountingJournals, listAccountingAccounts, listAccountingEntries } from "@/lib/accounting-actions";
import { ensureAccountingBaseSetup } from "@/lib/accounting";
import { requireActiveWorkspace } from "@/lib/auth";

export default async function AccountingPage() {
  const workspace = await requireActiveWorkspace();
  await ensureAccountingBaseSetup(workspace.organization.id);

  const [journalsResult, accountsResult, entriesResult] = await Promise.all([
    listAccountingJournals(),
    listAccountingAccounts(),
    listAccountingEntries({ pageSize: 0 }),
  ]);

  const journals = journalsResult.success && journalsResult.data ? (journalsResult.data as Array<Record<string, unknown>>) : [];
  const accounts = accountsResult.success && accountsResult.data ? (accountsResult.data as Array<Record<string, unknown>>) : [];
  const entries = entriesResult.success && entriesResult.data ? (entriesResult.data as { entries: Array<Record<string, unknown>>; total: number }) : { entries: [], total: 0 };

  const sections = [
    { title: "Plan comptable", href: "/comptabilite/plan-comptable", count: accounts.length, description: "Comptes comptables" },
    { title: "Journaux", href: "/comptabilite/journaux", count: journals.length, description: "Journaux de saisie" },
    { title: "Ecritures", href: "/comptabilite/ecritures", count: entries.total, description: "Saisie et consultation" },
    { title: "Auxiliaires", href: "/comptabilite/auxiliaires", count: 0, description: "Tiers comptables" },
    { title: "Exercices", href: "/comptabilite/exercices", count: 0, description: "Exercices et periodes" },
    { title: "Balance", href: "/comptabilite/balance", count: 0, description: "Balance des comptes" },
    { title: "Grand livre", href: "/comptabilite/grand-livre", count: 0, description: "Grand livre general" },
    { title: "Journal general", href: "/comptabilite/journal-general", count: 0, description: "Journal chronologique" },
    { title: "TVA", href: "/comptabilite/tva", count: 0, description: "Declaration et controle" },
    { title: "Exports", href: "/comptabilite/exports", count: 0, description: "Export cabinet comptable" },
    { title: "Parametres", href: "/comptabilite/parametres", count: 0, description: "Configuration" },
  ];

  return (
    <ModulePage>
      <PageHeader
        title="Comptabilite"
        description="Plan comptable, saisie, lettrage, declarations et exports."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sections.map((section) => (
          <Link key={section.href} href={section.href} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <h3 className="font-semibold text-[var(--foreground)]">{section.title}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{section.description}</p>
                {section.count > 0 ? (
                  <p className="mt-3 text-2xl font-bold text-[var(--primary)]">{section.count}</p>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </ModulePage>
  );
}
