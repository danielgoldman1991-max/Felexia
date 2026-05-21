import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DgiExportPreviewTable } from "@/components/comptabilite/tva/dgi-export-preview-table";
import { DgiExportSummaryCards } from "@/components/comptabilite/tva/dgi-export-summary-cards";
import { DgiExportValidationPanel } from "@/components/comptabilite/tva/dgi-export-validation-panel";
import { DgiExportWizard } from "@/components/comptabilite/tva/dgi-export-wizard";
import { TaxExportHistory } from "@/components/comptabilite/tva/tax-export-history";
import type { DgiVatExportData, DgiVatExportHistoryRow } from "@/lib/tax/dgi-vat-types";

function GenerationMessage({ status, batch }: { status?: string; batch?: string }) {
  if (!status) return null;

  const success = status === "success" || status === "existing";
  const preflight = status === "preflight-failed";
  const message = success
    ? status === "existing"
      ? "Un dossier préparatoire identique existe déjà pour cette période. Utilisez l'historique pour télécharger les fichiers."
      : "Dossier préparatoire TVA DGI généré avec succès."
    : preflight
      ? "Export non généré : anomalies bloquantes détectées. Le rapport de contrôle est historisé."
      : status === "unauthorized"
        ? "Votre rôle ne permet pas de générer un export TVA. Demandez un accès owner, admin ou comptable."
        : status === "storage-error"
          ? "Les fichiers n'ont pas pu être stockés dans le bucket privé tax-exports."
          : "L'opération n'a pas pu être finalisée. Vérifiez la période et la configuration Supabase.";

  return (
    <Card className={success ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
      <CardContent className="flex items-start gap-3 p-4 text-sm">
        {success ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />}
        <div className={success ? "text-emerald-950" : "text-amber-950"}>
          <p className="font-medium">{message}</p>
          {batch ? <p className="mt-1 font-mono text-xs opacity-80">Batch : {batch}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function TvaExportsPage({
  data,
  history,
  periodStart,
  periodEnd,
  frequency,
  generation,
  batch,
}: {
  data: DgiVatExportData;
  history: DgiVatExportHistoryRow[];
  periodStart: string;
  periodEnd: string;
  frequency: "monthly" | "quarterly";
  generation?: string;
  batch?: string;
}) {
  return (
    <div className="grid gap-6">
      <GenerationMessage status={generation} batch={batch} />

      <Card className="border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--primary-soft)] text-[var(--secondary)]">
              <FileText className="h-6 w-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">XML préparatoire DGI TVA</h2>
                <Badge tone="info">Préparatoire</Badge>
              </div>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--muted)]">
                Ce module génère un XML préparatoire DGI. Il ne constitue pas une homologation officielle DGI tant qu&apos;un schéma XSD SIMPL-TVA officiel n&apos;est pas configuré.
              </p>
            </div>
          </div>
          <Badge tone={data.summary.blockingErrorsCount > 0 ? "danger" : "success"}>
            {data.summary.blockingErrorsCount > 0 ? "Pré-contrôles à corriger" : "Prêt à générer"}
          </Badge>
        </CardContent>
      </Card>

      <DgiExportWizard periodStart={periodStart} periodEnd={periodEnd} frequency={frequency} />
      <DgiExportSummaryCards summary={data.summary} />

      {data.summary.blockingErrorsCount > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Des anomalies bloquantes ont été détectées. Corrigez les pièces concernées avant de générer un export XML préparatoire.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DgiExportValidationPanel
          issues={data.validationIssues}
          returnTo={`/comptabilite/tva/exports?from=${periodStart}&to=${periodEnd}&frequency=${frequency}&preflight=1`}
        />
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold text-[var(--foreground)]">Prudence fiscale</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Felexia prépare les données TVA pour contrôle et déclaration. Le dépôt officiel reste effectué sur les services DGI selon les modalités en vigueur.
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Le XML généré est structuré pour faciliter le travail de l&apos;entreprise ou de son expert-comptable et restera adaptable si un schéma XSD officiel SIMPL-TVA est fourni.
            </p>
          </CardContent>
        </Card>
      </div>

      <DgiExportPreviewTable data={data} />
      <TaxExportHistory history={history} />
    </div>
  );
}
