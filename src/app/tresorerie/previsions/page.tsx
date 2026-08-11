import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Download, Landmark, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { PremiumKpiCard } from "@/components/ui/kpi-card";
import { TreasuryForecastFilters } from "@/components/treasury/treasury-forecast-filters";
import { TreasuryForecastChart } from "@/components/treasury/treasury-forecast-chart";
import { TreasuryForecastManualItem } from "@/components/treasury/treasury-forecast-manual-item";
import { TreasuryPrintButton } from "@/components/treasury/treasury-print-button";
import { listTreasuryAccounts } from "@/lib/treasury";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWorkspace } from "@/lib/auth";
import { formatMoney, formatDate } from "@/lib/format";
import { getTreasuryForecast, type TreasuryForecastItem, type TreasuryForecastScenario } from "@/lib/treasury/treasury-forecast";

export const dynamic = "force-dynamic";

const SCENARIO_LABELS: Record<TreasuryForecastScenario, string> = {
  prudent: "Prudent",
  realistic: "Realiste",
  optimistic: "Optimiste",
};

function toLocalIso(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().slice(0, 10);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    validated: "Validee",
    sent: "Envoyee",
    partially_paid: "Partiellement payee",
    overdue: "En retard",
    paid: "Payee",
    draft: "Brouillon",
    cancelled: "Annulee",
    planned: "Planifiee",
    confirmed: "Confirmee",
    realized: "Realisee",
    ignored: "Ignoree",
  };
  return labels[status] ?? status;
}

function badgeToneForStatus(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (["paid", "realized"].includes(status)) return "success";
  if (["overdue", "cancelled"].includes(status)) return "danger";
  if (["sent", "confirmed"].includes(status)) return "info";
  if (["partially_paid"].includes(status)) return "warning";
  return "neutral";
}

function sourceLabel(item: TreasuryForecastItem) {
  if (item.sourceType === "customer_invoice") return "Facture client";
  if (item.sourceType === "supplier_invoice") return "Facture fournisseur";
  if (item.sourceType === "scheduled_payment") return "Paiement programme";
  return "Prevision manuelle";
}

export default async function TreasuryForecastPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const scenario = (get("scenario") ?? "realistic") as TreasuryForecastScenario;
  const periode = get("periode") ?? "30";
  const accountId = get("account") || null;
  const includeOverdue = get("overdue") !== "0";
  const direction = (get("type") ?? "all") as "inflow" | "outflow" | "all";
  const from = get("from") || toLocalIso(0);
  const to = get("to") || toLocalIso(Number.parseInt(periode, 10) || 30);

  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const [accounts, forecast] = await Promise.all([
    listTreasuryAccounts(),
    getTreasuryForecast(supabase, workspace.organization.id, {
      from,
      to,
      scenario,
      includeOverdue,
      treasuryAccountId: accountId,
      direction,
    }),
  ]);

  const hasItems = forecast.inflows.length > 0 || forecast.outflows.length > 0 || forecast.hypothesis.manualItemCount > 0;
  const isNegative = forecast.lowestForecastBalance < 0;

  const exportParams = new URLSearchParams({
    from,
    to,
    scenario,
    overdue: includeOverdue ? "1" : "0",
    account: accountId ?? "",
    type: direction,
  });
  const exportHref = `/tresorerie/previsions/export?${exportParams.toString()}`;


  return (
    <ModulePage>
      <PageHeader
        title="Previsions de tresorerie"
        description="Anticipez vos encaissements, decaissements et soldes previsionnels a partir des factures ouvertes, echeances fournisseurs et comptes de tresorerie."
        actions={
          <>
            <Button variant="secondary" asChild><Link href={exportHref}><Download className="h-4 w-4" /> Exporter CSV</Link></Button>
            <TreasuryPrintButton />
            <form action="">
              <Button type="submit" variant="secondary"><RefreshCw className="h-4 w-4" /> Actualiser</Button>
            </form>
            <Button asChild><Link href="/tresorerie/previsions/nouveau"><Plus className="h-4 w-4" /> Nouvelle prevision manuelle</Link></Button>
          </>
        }
      />

      <TreasuryForecastFilters accounts={accounts} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <PremiumKpiCard
          label="Solde actuel"
          value={formatMoney(forecast.openingBalance)}
          caption={forecast.hypothesis.accountName ? `Compte : ${forecast.hypothesis.accountName}` : `${forecast.hypothesis.activeAccountCount} compte(s) actif(s)`}
          icon={Landmark}
          tone="cyan"
        />
        <PremiumKpiCard
          label="Encaissements attendus"
          value={formatMoney(forecast.totalExpectedInflows)}
          caption={`${forecast.inflows.length} flux attendus`}
          icon={ArrowUpRight}
          tone="success"
        />
        <PremiumKpiCard
          label="Decaissements attendus"
          value={formatMoney(forecast.totalExpectedOutflows)}
          caption={`${forecast.outflows.length} flux attendus`}
          icon={ArrowDownRight}
          tone="danger"
        />
        <PremiumKpiCard
          label="Solde previsionnel fin de periode"
          value={formatMoney(forecast.closingForecastBalance)}
          caption={`Net : ${formatMoney(forecast.netCashFlow)}`}
          icon={CalendarClock}
          tone={forecast.closingForecastBalance < 0 ? "danger" : "violet"}
        />
        <PremiumKpiCard
          label="Point bas de tresorerie"
          value={formatMoney(forecast.lowestForecastBalance)}
          caption={isNegative ? "Solde negatif atteint" : "Solde minimum prevu"}
          icon={ShieldAlert}
          tone={isNegative ? "danger" : "warning"}
        />
        <PremiumKpiCard
          label="Jours critiques"
          value={forecast.criticalDaysCount}
          caption={forecast.criticalDaysCount > 0 ? "Jours a solde negatif" : "Aucun jour negatif"}
          icon={AlertTriangle}
          tone={forecast.criticalDaysCount > 0 ? "danger" : "success"}
        />
      </div>

      {forecast.alerts.length > 0 ? (
        <section className="mb-6 space-y-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Alertes de tresorerie</h2>
          {forecast.alerts.map((alert, index) => (
            <div key={index} className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)]">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  alert.severity === "danger" ? "bg-[var(--danger-soft)] text-[var(--danger)]" : alert.severity === "warning" ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--info-soft)] text-[var(--info)]"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{alert.title}</p>
                <p className="mt-0.5 text-sm leading-6 text-[var(--muted)]">{alert.message}</p>
                {alert.amount !== undefined ? <p className="mt-1 text-xs font-medium text-[var(--foreground)]">{formatMoney(alert.amount)}</p> : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <div className="mb-6">
        <TreasuryForecastChart daily={forecast.daily} />
      </div>

      {!hasItems ? (
        <Card><CardContent>
          <EmptyState
            title="Aucune prevision disponible pour cette periode."
            description="Creez des factures, ajoutez des echeances fournisseur ou saisissez une prevision manuelle pour commencer a piloter votre tresorerie."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild><Link href="/tresorerie/previsions/nouveau"><Plus className="h-4 w-4" /> Ajouter une prevision manuelle</Link></Button>
                <Button variant="secondary" asChild><Link href="/facturation/factures/new">Creer une facture client</Link></Button>
                <Button variant="secondary" asChild><Link href="/achats/factures/new">Creer une facture fournisseur</Link></Button>
              </div>
            }
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Calendrier des flux</h2>
                  <p className="text-sm text-[var(--muted)]">Flux attendus sur la periode, solde apres chaque operation.</p>
                </div>
                <Badge tone="info">Scenario : {SCENARIO_LABELS[scenario]}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Type</Th>
                      <Th>Tiers</Th>
                      <Th>Document</Th>
                      <Th>Libelle</Th>
                      <Th>Entree</Th>
                      <Th>Sortie</Th>
                      <Th>Proba</Th>
                      <Th>Montant pondere</Th>
                      <Th>Solde apres flux</Th>
                      <Th>Statut</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...forecast.inflows, ...forecast.outflows]
                      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                      .map((item) => {
                        const dailyPoint = forecast.daily.find((day) => day.date === (item.dueDate < from ? from : item.dueDate));
                        return (
                          <tr key={item.id}>
                            <Td>{formatDate(item.dueDate)}</Td>
                            <Td><Badge tone={item.direction === "inflow" ? "success" : "danger"}>{sourceLabel(item)}</Badge></Td>
                            <Td>{item.thirdPartyName ?? "-"}</Td>
                            <Td>{item.documentNumber ?? "-"}</Td>
                            <Td className="max-w-[240px]">
                              {item.href ? (
                                <Link href={item.href} className="block truncate font-medium text-[var(--primary)] hover:underline">{item.label}</Link>
                              ) : (
                                <span className="block truncate">{item.label}</span>
                              )}
                              {item.hasFallbackDate ? <span className="block text-xs text-[var(--warning)]">Echeance estimee (30j)</span> : null}
                            </Td>
                            <Td>{item.direction === "inflow" ? <span className="font-medium text-[var(--success)]">{formatMoney(item.weightedAmount)}</span> : <span className="text-[var(--muted)]">-</span>}</Td>
                            <Td>{item.direction === "outflow" ? <span className="font-medium text-[var(--danger)]">{formatMoney(item.weightedAmount)}</span> : <span className="text-[var(--muted)]">-</span>}</Td>
                            <Td>{Math.round(item.probability)} %</Td>
                            <Td>{formatMoney(item.weightedAmount)}</Td>
                            <Td className={dailyPoint?.isCritical ? "font-semibold text-[var(--danger)]" : ""}>{dailyPoint ? formatMoney(dailyPoint.closingBalance) : "-"}</Td>
                            <Td><Badge tone={badgeToneForStatus(item.status)}>{statusLabel(item.status)}</Badge></Td>
                          </tr>
                        );
                      })}
                  </tbody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><h2 className="font-semibold">Encaissements attendus</h2></CardHeader>
              <CardContent>
                {forecast.inflows.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Aucun encaissement attendu sur la periode.</p>
                ) : (
                  <ul className="space-y-2">
                    {forecast.inflows.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)]/40 px-3 py-2.5">
                        <div className="min-w-0">
                          {item.href ? (
                            <Link href={item.href} className="block truncate text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)] hover:underline">{item.label}</Link>
                          ) : (
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.label}</p>
                          )}
                          <p className="text-xs text-[var(--muted)]">{item.thirdPartyName ?? "Sans tiers"} &middot; {formatDate(item.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[var(--success)]">{formatMoney(item.weightedAmount)}</p>
                          <p className="text-xs text-[var(--muted)]">{Math.round(item.probability)} %</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><h2 className="font-semibold">Decaissements attendus</h2></CardHeader>
              <CardContent>
                {forecast.outflows.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Aucun decaissement attendu sur la periode.</p>
                ) : (
                  <ul className="space-y-2">
                    {forecast.outflows.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)]/40 px-3 py-2.5">
                        <div className="min-w-0">
                          {item.href ? (
                            <Link href={item.href} className="block truncate text-sm font-medium text-[var(--foreground)] hover:text-[var(--primary)] hover:underline">{item.label}</Link>
                          ) : (
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.label}</p>
                          )}
                          <p className="text-xs text-[var(--muted)]">{item.thirdPartyName ?? "Sans tiers"} &middot; {formatDate(item.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[var(--danger)]">{formatMoney(item.weightedAmount)}</p>
                          <p className="text-xs text-[var(--muted)]">{Math.round(item.probability)} %</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Previsions manuelles</h2>
                  <p className="text-sm text-[var(--muted)]">Flux saisis a la main pour affiner vos previsions (loyers, salaires, apports...).</p>
                </div>
                <Button variant="secondary" className="h-8" asChild><Link href="/tresorerie/previsions/nouveau"><Plus className="h-4 w-4" /> Ajouter</Link></Button>
              </div>
            </CardHeader>
            <CardContent>
              {forecast.hypothesis.manualItemCount === 0 ? (
                <p className="text-sm text-[var(--muted)]">Aucune prevision manuelle sur la periode.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th>Sens</Th>
                        <Th>Libelle</Th>
                        <Th>Montant</Th>
                        <Th>Proba</Th>
                        <Th>Pondere</Th>
                        <Th>Statut</Th>
                        <Th>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...forecast.inflows, ...forecast.outflows]
                        .filter((item) => item.sourceType === "manual" || item.sourceType === "scheduled_payment")
                        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                        .map((item) => <TreasuryForecastManualItem key={item.id} item={item} />)}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold">Hypotheses de calcul</h2></CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)]/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Solde de depart</p>
                  <p className="mt-1 font-medium">{formatMoney(forecast.openingBalance)}</p>
                  <p className="text-xs text-[var(--muted)]">Somme des soldes des {forecast.hypothesis.activeAccountCount} compte(s) actif(s){forecast.hypothesis.accountName ? ` (${forecast.hypothesis.accountName})` : ""}.</p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)]/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Source des flux</p>
                  <p className="mt-1 font-medium">{forecast.hypothesis.invoiceCount} factures clients, {forecast.hypothesis.supplierInvoiceCount} factures fournisseurs, {forecast.hypothesis.manualItemCount} previsions manuelles.</p>
                  <p className="text-xs text-[var(--muted)]">Montants = restant a encaisser / payer (hors payees et annulees).</p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)]/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Scenario : {SCENARIO_LABELS[scenario]}</p>
                  <p className="mt-1 font-medium">
                    {scenario === "prudent" ? "Encaissements ponderes a 70 %, decaissements a 100 %." : scenario === "optimistic" ? "Encaissements et decaissements a 100 %." : "Probabilites normales (echues : 70 %)."}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{forecast.hypothesis.invoiceWithoutDueDateCount} facture(s) sans echeance estimee a 30 jours.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="mt-4 text-xs text-[var(--muted)]">Periode du {formatDate(from)} au {formatDate(to)}.</p>
    </ModulePage>
  );
}
