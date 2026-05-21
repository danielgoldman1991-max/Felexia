import Link from "next/link";
import { Plus, FileText, AlertTriangle, CheckCircle2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { formatDate } from "@/lib/format";
import { listVatDeclarations, getVatDeclarationCounters } from "@/lib/tax/vat-declarations";
import {
  VAT_DECLARATION_STATUS_LABELS,
  VAT_DECLARATION_FREQUENCY_LABELS,
} from "@/lib/tax/vat-declaration-types";
import type { VatDeclarationRecord } from "@/lib/tax/vat-declaration-types";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const toneMap: Record<string, string> = {
    draft: "neutral",
    under_review: "warning",
    validated: "success",
    exported: "info",
    archived: "neutral",
  };
  return <Badge tone={toneMap[status] as never}>{VAT_DECLARATION_STATUS_LABELS[status as never] ?? status}</Badge>;
}

export default async function VatDeclarationsPage() {
  const [{ declarations, ready, message }, counters] = await Promise.all([
    listVatDeclarations(),
    getVatDeclarationCounters(),
  ]);

  return (
    <ModulePage>
      <PageHeader
        title="Déclarations TVA"
        description="Préparez et suivez vos déclarations périodiques de TVA."
        actions={
          <Link href="/comptabilite/tva/declarations/new">
            <Button disabled={!ready}><Plus className="h-4 w-4" /> Nouvelle déclaration TVA</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Brouillons" value={counters.draft} icon={<FileText className="h-4 w-4" />} />
        <StatCard title="Validées" value={counters.validated} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard title="Exportées" value={counters.exported} icon={<FileText className="h-4 w-4" />} />
        <StatCard title="TVA due totale" value={<MoneyDisplay value={counters.totalVatDue} />} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {!ready ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <Database className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900">Module Déclarations TVA non initialisé</h3>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                {message ?? "La table vat_declarations n'existe pas encore dans la base de données."}
              </p>
              <div className="mt-3 rounded-md bg-white/60 p-3 text-xs font-mono text-amber-900">
                supabase db push
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6 border-dashed bg-[linear-gradient(180deg,#fff_0%,#fbfcff_100%)]">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">Déclarations TVA en préparation</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Cette page permet de préparer les déclarations de TVA par période, de contrôler les montants de TVA collectée et récupérable, puis de générer les états nécessaires à la déclaration. Le dépôt officiel reste à effectuer selon les modalités DGI/SIMPL applicables.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {declarations.length === 0 ? (
            <EmptyState title="Aucune déclaration TVA" description={ready ? "Créez votre première déclaration TVA préparatoire." : "Le module n'est pas encore prêt."} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Numéro</Th>
                  <Th>Période</Th>
                  <Th>Fréquence</Th>
                  <Th>Statut</Th>
                  <Th className="text-right">TVA collectée</Th>
                  <Th className="text-right">TVA récupérable</Th>
                  <Th className="text-right">TVA due</Th>
                  <Th className="text-right">Crédit</Th>
                  <Th>Anomalies</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {declarations.map((d: VatDeclarationRecord) => (
                  <tr key={d.id}>
                    <Td className="font-medium">{d.declaration_number}</Td>
                    <Td>{formatDate(d.period_start)} — {formatDate(d.period_end)}</Td>
                    <Td>{VAT_DECLARATION_FREQUENCY_LABELS[d.frequency]}</Td>
                    <Td><StatusBadge status={d.status} /></Td>
                    <Td className="text-right"><MoneyDisplay value={d.collected_vat} /></Td>
                    <Td className="text-right"><MoneyDisplay value={d.deductible_vat} /></Td>
                    <Td className="text-right"><MoneyDisplay value={d.vat_due} /></Td>
                    <Td className="text-right"><MoneyDisplay value={d.credit_to_carry_forward} /></Td>
                    <Td>
                      {d.blocking_errors_count > 0 ? (
                        <Badge tone="danger">{d.blocking_errors_count} bloquante{d.blocking_errors_count > 1 ? "s" : ""}</Badge>
                      ) : d.warnings_count > 0 ? (
                        <Badge tone="warning">{d.warnings_count} alerte{d.warnings_count > 1 ? "s" : ""}</Badge>
                      ) : (
                        <Badge tone="success">OK</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/comptabilite/tva/declarations/${d.id}`}>
                          <Button type="button" variant="secondary">Consulter</Button>
                        </Link>
                        {d.status === "draft" || d.status === "under_review" ? (
                          <Link href={`/comptabilite/tva/exports?from=${d.period_start}&to=${d.period_end}&frequency=${d.frequency}&preflight=1`}>
                            <Button type="button" variant="secondary">Exporter</Button>
                          </Link>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </ModulePage>
  );
}
