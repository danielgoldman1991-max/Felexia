import Link from "next/link";
import { Pencil, ArrowLeft } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { MoneyDisplay } from "@/components/erp/money-display";
import { getAccountingAccount } from "@/lib/accounting-actions";
import { getChartOfAccountUsageStats, getChartOfAccountDetail, listRecentEntryLinesForAccount } from "@/lib/accounting";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_CLASS_LABELS } from "@/lib/accounting-types";
import type { AccountingAccountRecord } from "@/lib/accounting-types";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [accountResult, detailResult, usageStats, recentLines] = await Promise.all([
    getAccountingAccount(id),
    getChartOfAccountDetail(id),
    getChartOfAccountUsageStats(id),
    listRecentEntryLinesForAccount(id),
  ]);

  const account = accountResult.success && accountResult.data
    ? accountResult.data as AccountingAccountRecord
    : null;

  if (!account) {
    return (
      <ModulePage>
        <PageHeader title="Compte introuvable" description="Le compte demande n'existe pas." />
        <EmptyState title="Compte introuvable" description="Verifiez l'URL ou retournez au plan comptable." />
      </ModulePage>
    );
  }

  const isUsed = usageStats.lines_count > 0;

  return (
    <ModulePage>
      <PageHeader
        title={`${account.code} - ${account.name}`}
        description="Detail du compte comptable."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/comptabilite/plan-comptable">
              <Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Retour</Button>
            </Link>
            <Link href={`/comptabilite/plan-comptable/${account.id}/edit`}>
              <Button variant="primary"><Pencil className="h-4 w-4" /> Modifier</Button>
            </Link>
          </div>
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
            <div><span className="text-[var(--muted)]">Numero:</span> <span className="font-mono font-medium">{account.code}</span></div>
            <div><span className="text-[var(--muted)]">Intitule:</span> {account.name}</div>
            <div><span className="text-[var(--muted)]">Classe:</span> <Badge tone="info">{ACCOUNT_CLASS_LABELS[account.class_number] ?? account.class_number}</Badge></div>
            <div><span className="text-[var(--muted)]">Type:</span> {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}</div>
            <div><span className="text-[var(--muted)]">Compte parent:</span> {
              detailResult?.parent
                ? <Link href={`/comptabilite/plan-comptable/${detailResult.parent.id}`} className="text-indigo-700 hover:underline">{detailResult.parent.code} - {detailResult.parent.name}</Link>
                : "-"
            }</div>
            <div><span className="text-[var(--muted)]">Auxiliaire:</span> {account.is_auxiliary ? <Badge tone="warning">Oui</Badge> : "Non"}</div>
            <div><span className="text-[var(--muted)]">Statut:</span> <Badge tone={account.is_active ? "success" : "danger"}>{account.is_active ? "Actif" : "Inactif"}</Badge></div>
            <div><span className="text-[var(--muted)]">Compte systeme:</span> {account.is_system ? "Oui" : "Non"}</div>
            {account.notes ? <div className="col-span-full"><span className="text-[var(--muted)]">Notes:</span> {account.notes}</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">Utilisation du compte</h2></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
            <div>
              <span className="text-[var(--muted)]">Lignes d&apos;ecriture:</span>
              <div className="mt-1 text-lg font-semibold">{usageStats.lines_count}</div>
            </div>
            <div>
              <span className="text-[var(--muted)]">Total debit:</span>
              <div className="mt-1 text-lg font-semibold"><MoneyDisplay value={usageStats.total_debit} /></div>
            </div>
            <div>
              <span className="text-[var(--muted)]">Total credit:</span>
              <div className="mt-1 text-lg font-semibold"><MoneyDisplay value={usageStats.total_credit} /></div>
            </div>
            <div>
              <span className="text-[var(--muted)]">Solde:</span>
              <div className="mt-1 text-lg font-semibold"><MoneyDisplay value={usageStats.balance} /></div>
            </div>
            <div className="col-span-full">
              <span className="text-[var(--muted)]">Derniere utilisation:</span> {usageStats.last_used_date ? new Date(usageStats.last_used_date).toLocaleDateString("fr-FR") : "Jamais"}
            </div>
          </CardContent>
        </Card>

        {isUsed && (
          <Card>
            <CardHeader><h2 className="font-semibold">Dernieres lignes d&apos;ecriture</h2></CardHeader>
            <CardContent className="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Ecriture</Th>
                    <Th>Libelle</Th>
                    <Th>Debit</Th>
                    <Th>Credit</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentLines.map((line) => (
                    <tr key={line.id}>
                      <Td className="whitespace-nowrap">{line.entry_date}</Td>
                      <Td>
                        <Link href={`/comptabilite/ecritures/${line.entry_id}`} className="font-medium text-indigo-700 hover:underline">
                          {line.entry_number}
                        </Link>
                      </Td>
                      <Td className="max-w-[200px] truncate">{line.label ?? "-"}</Td>
                      <Td className="font-mono tabular-nums"><MoneyDisplay value={line.debit} /></Td>
                      <Td className="font-mono tabular-nums"><MoneyDisplay value={line.credit} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </ModulePage>
  );
}