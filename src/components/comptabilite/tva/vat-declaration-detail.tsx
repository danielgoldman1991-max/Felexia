"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, Archive, ArrowLeft, Calculator, CheckCircle2, FileText, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoneyDisplay } from "@/components/erp/money-display";
import { PageHeader } from "@/components/erp/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { validateVatDeclarationAction, archiveVatDeclarationAction, autoFixVatDeclarationAnomaliesAction } from "@/lib/tax/vat-declaration-actions";
import { classifyVatAnomaly } from "@/lib/tax/vat-anomaly-autofix";
import {
  VAT_DECLARATION_STATUS_LABELS,
  VAT_DECLARATION_FREQUENCY_LABELS,
  VAT_DECLARATION_REGIME_LABELS,
} from "@/lib/tax/vat-declaration-types";
import type { VatDeclarationRecord, VatDeclarationActionResult } from "@/lib/tax/vat-declaration-types";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm">{value ?? "-"}</div>
    </div>
  );
}

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

function ActionForm({ label, icon, action, variant = "secondary" }: { label: string; icon?: React.ReactNode; action: (prev: VatDeclarationActionResult) => Promise<VatDeclarationActionResult>; variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const [state, formAction, pending] = useActionState(action, { success: true });
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <Button variant={variant} disabled={pending}>{icon}{label}</Button>
      {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
      {state.success && !state.error && state.declarationId === undefined ? <span className="text-xs text-green-600">Terminé</span> : null}
    </form>
  );
}

export function VatDeclarationDetail({ declaration }: { declaration: VatDeclarationRecord }) {
  const canValidate = (declaration.status === "draft" || declaration.status === "under_review") && declaration.blocking_errors_count === 0;
  const canArchive = declaration.status === "draft" || declaration.status === "under_review";
  const hasBlocking = declaration.blocking_errors_count > 0;

  const validationIssues = (declaration.validation_summary?.issues ?? []) as Array<{
    severity: string;
    code: string;
    message: string;
    source?: string;
    sourceId?: string | null;
    correctionUrl?: string | null;
    correctionLabel?: string | null;
  }>;

  const blockingIssues = validationIssues.filter((i) => i.severity === "blocking");
  const warningIssues = validationIssues.filter((i) => i.severity === "warning");

  const autoFixHistory = (declaration.validation_summary?.auto_fix_history ?? []) as Array<Record<string, unknown>>;
  const lastAutoFix = autoFixHistory.length > 0 ? autoFixHistory[autoFixHistory.length - 1] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Déclaration TVA ${declaration.declaration_number}`}
        description={`${VAT_DECLARATION_FREQUENCY_LABELS[declaration.frequency]} — ${formatDate(declaration.period_start)} au ${formatDate(declaration.period_end)}`}
        actions={
          <>
            <Link href="/comptabilite/tva/declarations">
              <Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Retour</Button>
            </Link>
            {hasBlocking ? (
              <ActionForm
                label="Corriger automatiquement"
                icon={<Wrench className="h-4 w-4" />}
                variant="primary"
                action={async (prev) => {
                  const fd = new FormData();
                  fd.set("id", declaration.id);
                  return autoFixVatDeclarationAnomaliesAction(prev, fd);
                }}
              />
            ) : null}
            {canValidate ? (
              <ActionForm
                label="Valider la déclaration"
                icon={<CheckCircle2 className="h-4 w-4" />}
                action={async (prev) => {
                  const fd = new FormData();
                  fd.set("id", declaration.id);
                  return validateVatDeclarationAction(prev, fd);
                }}
              />
            ) : null}
            <Link href={`/comptabilite/tva/exports?from=${declaration.period_start}&to=${declaration.period_end}&frequency=${declaration.frequency}&preflight=1`}>
              <Button variant="secondary"><FileText className="h-4 w-4" /> Exporter</Button>
            </Link>
            {canArchive ? (
              <ActionForm
                label="Archiver"
                icon={<Archive className="h-4 w-4" />}
                variant="danger"
                action={async (prev) => {
                  const fd = new FormData();
                  fd.set("id", declaration.id);
                  return archiveVatDeclarationAction(prev, fd);
                }}
              />
            ) : null}
          </>
        }
      />

      {hasBlocking ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm text-red-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Anomalies bloquantes détectées</p>
                <p className="mt-1 text-red-900">
                  Cette déclaration contient {declaration.blocking_errors_count} anomalie{declaration.blocking_errors_count > 1 ? "s" : ""} bloquante{declaration.blocking_errors_count > 1 ? "s" : ""}. Corrigez-les avant validation.
                </p>
              </div>
            </div>
            <ActionForm
              label="Corriger automatiquement"
              icon={<Wrench className="h-4 w-4" />}
              variant="primary"
              action={async (prev) => {
                const fd = new FormData();
                fd.set("id", declaration.id);
                return autoFixVatDeclarationAnomaliesAction(prev, fd);
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {lastAutoFix ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-sm text-green-950">
            <p className="font-medium">Dernière correction automatique</p>
            <p className="mt-1 text-green-900">
              {Number(lastAutoFix.fixedCount ?? 0)} anomalie(s) corrigée(s), {Number(lastAutoFix.remainingBlockingCount ?? 0)} bloquante(s) restante(s).
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <StatusBadge status={declaration.status} />
          <span className="text-sm text-[var(--muted)]">Créée le {formatDate(declaration.created_at)}</span>
          {declaration.validated_at ? <span className="text-sm text-green-600">Validée le {formatDate(declaration.validated_at)}</span> : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-[var(--muted)]">TVA collectée</p>
            <p className="mt-2 text-2xl font-semibold"><MoneyDisplay value={declaration.collected_vat} /></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-[var(--muted)]">TVA récupérable</p>
            <p className="mt-2 text-2xl font-semibold"><MoneyDisplay value={declaration.deductible_vat} /></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-[var(--muted)]">TVA due</p>
            <p className="mt-2 text-2xl font-semibold"><MoneyDisplay value={declaration.vat_due} /></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-[var(--muted)]">Crédit à reporter</p>
            <p className="mt-2 text-2xl font-semibold"><MoneyDisplay value={declaration.credit_to_carry_forward} /></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Informations</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Info label="Période" value={`${formatDate(declaration.period_start)} — ${formatDate(declaration.period_end)}`} />
          <Info label="Fréquence" value={VAT_DECLARATION_FREQUENCY_LABELS[declaration.frequency]} />
          <Info label="Régime TVA" value={VAT_DECLARATION_REGIME_LABELS[declaration.vat_regime]} />
          <Info label="Crédit antérieur" value={<MoneyDisplay value={declaration.prior_credit} />} />
          <Info label="Chiffre d'affaires taxable" value={<MoneyDisplay value={declaration.taxable_turnover} />} />
          <Info label="Notes" value={declaration.notes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Totaux par taux TVA</h2></CardHeader>
        <CardContent>
          {Object.keys(declaration.totals_by_rate ?? {}).length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Aucun détail par taux disponible.</p>
          ) : (
            <Table>
              <thead>
                <tr><Th>Taux</Th><Th className="text-right">TVA collectée</Th><Th className="text-right">TVA récupérable</Th></tr>
              </thead>
              <tbody>
                {Object.entries(declaration.totals_by_rate as Record<string, { collected: number; deductible: number }>).map(([rate, totals]) => (
                  <tr key={rate}>
                    <Td>{rate}%</Td>
                    <Td className="text-right"><MoneyDisplay value={totals.collected} /></Td>
                    <Td className="text-right"><MoneyDisplay value={totals.deductible} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="font-semibold">Documents inclus</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Info label="Factures clients" value={`${declaration.customer_invoices_count}`} />
          <Info label="Factures fournisseurs" value={`${declaration.supplier_invoices_count}`} />
        </CardContent>
      </Card>

      {validationIssues.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--muted)]" />
              <h2 className="font-semibold">Contrôles et anomalies</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {blockingIssues.map((issue, i) => {
                const classification = classifyVatAnomaly(issue as never);
                return (
                  <div key={`b-${i}`} className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                    <div className="flex flex-wrap items-start gap-2">
                      <Badge tone="danger">Bloquante</Badge>
                      <span className="font-medium text-red-900">{issue.message}</span>
                      <Badge tone={classification.fixability === "auto_fixable" ? "success" : classification.fixability === "dangerous_do_not_fix" ? "neutral" : "warning"}>
                        {classification.actionLabel}
                      </Badge>
                    </div>
                    {issue.correctionUrl ? (
                      <Link href={issue.correctionUrl} className="mt-2 inline-block text-xs text-red-700 underline">
                        {issue.correctionLabel ?? "Corriger"}
                      </Link>
                    ) : null}
                  </div>
                );
              })}
              {warningIssues.map((issue, i) => (
                <div key={`w-${i}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge tone="warning">Alerte</Badge>
                    <span className="font-medium text-amber-900">{issue.message}</span>
                  </div>
                  {issue.correctionUrl ? (
                    <Link href={issue.correctionUrl} className="mt-2 inline-block text-xs text-amber-700 underline">
                      {issue.correctionLabel ?? "Corriger"}
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-dashed bg-[linear-gradient(180deg,#fff_0%,#fbfcff_100%)]">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <FileText className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">Note prudente</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Cette déclaration TVA est une préparation interne Felexia. Le dépôt officiel reste à effectuer selon les modalités DGI/SIMPL applicables.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
