import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { generateDgiVatPreparationAction } from "@/lib/tva-actions";
import { getVatExportPreview, type VatExportControl, type VatExportFilters } from "@/lib/tva";

export const dynamic = "force-dynamic";

type VatExportSearchParams = Promise<{
  from?: string;
  to?: string;
  type?: string;
  regime?: string;
  source?: string;
  status?: string;
  format?: string;
  q?: string;
  generation?: string;
}>;

const exportTypeOptions = [
  { value: "summary", label: "Synthèse TVA" },
  { value: "collected", label: "TVA collectée" },
  { value: "deductible", label: "TVA récupérable" },
  { value: "customer_invoices", label: "Factures clients" },
  { value: "supplier_invoices", label: "Factures fournisseurs" },
  { value: "deductions", label: "Relevé des déductions" },
  { value: "archive", label: "Archive justificative" },
  { value: "dgi", label: "Dossier DGI TVA préparatoire" },
];

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function searchValue(value?: string) {
  return value ?? "";
}

function buildExportHref(filters: VatExportFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value));
  }
  const query = params.toString();
  return `/comptabilite/tva/exports/export${query ? `?${query}` : ""}`;
}

function safeDate(value: string | null | undefined) {
  return value ? formatDate(value) : "-";
}

function statusTone(status?: string | null): "neutral" | "info" | "success" | "warning" | "danger" {
  if (!status) return "neutral";
  if (["validated", "sent", "posted", "paid", "ready"].includes(status)) return "success";
  if (["draft", "previewed", "not_posted", "generated_with_warnings", "downloaded", "generated"].includes(status)) return "warning";
  if (["cancelled", "failed", "blocked"].includes(status)) return "danger";
  return "info";
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: "Brouillon",
    previewed: "Prévisualisé",
    blocked: "Bloqué",
    generated: "Généré",
    generated_with_warnings: "Généré avec alertes",
    ready: "Prêt pour déclaration",
    downloaded: "Téléchargé",
    archived: "Archivé",
    failed: "Échec",
  };
  return status ? labels[status] ?? status : "-";
}

function controlTone(control: VatExportControl): "success" | "warning" | "danger" {
  if (control.severity === "blocking") return "danger";
  if (control.severity === "warning") return "warning";
  return "success";
}

function SummaryCard({
  title,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  helper: string;
  icon: typeof FileText;
  tone: "blue" | "emerald" | "amber" | "rose" | "purple" | "slate";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.03em] text-[var(--muted)]">{title}</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
          </div>
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]", styles[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{helper}</p>
      </CardContent>
    </Card>
  );
}

export default async function VatExportsPage({ searchParams }: { searchParams: VatExportSearchParams }) {
  const params = await searchParams;
  const month = currentMonthRange();
  const filters: VatExportFilters = {
    from: params.from ?? month.from,
    to: params.to ?? month.to,
    type: params.type ?? "summary",
    regime: params.regime ?? "monthly",
    source: params.source ?? "all",
    status: params.status ?? "all",
    format: params.format ?? "csv",
    q: params.q,
  };
  const preview = await getVatExportPreview(filters);
  const exportHref = buildExportHref(preview.filters);
  const rows = preview.rows.slice(0, 100);

  return (
    <ModulePage>
      <PageHeader
        title="Exports DGI"
        description="Préparez, contrôlez et archivez les exports fiscaux liés à la TVA."
        actions={
          <>
            <Link
              href={exportHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-all hover:bg-[#6840dc]"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Link>
            <Button variant="secondary" disabled className="cursor-not-allowed">
              <FileSpreadsheet className="h-4 w-4" />
              Excel
              <Badge tone="warning">Bientôt</Badge>
            </Button>
          </>
        }
      />

      {params.generation ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {params.generation === "storage-error"
                ? "Le dossier préparatoire a été calculé, mais son fichier n'a pas pu être stocké. Vérifiez la migration et le bucket tax-exports."
                : "Le dossier préparatoire DGI TVA n'a pas pu être généré. Vérifiez la période et la configuration Supabase."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fffb_100%)]">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">Cockpit de préparation TVA</h2>
                  <Badge tone="info">Préparation avancée</Badge>
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  Les exports générés par Felexia sont des fichiers de préparation et de contrôle. Le format DGI officiel sera activé après validation du cahier des charges fiscal applicable.
                </p>
              </div>
            </div>
            <a
              href="#generation-dgi-tva"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-700 shadow-[var(--shadow-sm)] transition-all hover:bg-emerald-50"
            >
              Dossier DGI TVA
              <Badge tone="info">Préparatoire</Badge>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-amber-50 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Prudence fiscale</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Vérifiez les anomalies et les écritures comptables avant toute déclaration définitive.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          title="TVA collectée"
          value={formatMoney(preview.summary.collectedVat)}
          helper="Factures clients et écritures 4455 incluses."
          icon={Landmark}
          tone="blue"
        />
        <SummaryCard
          title="TVA récupérable"
          value={formatMoney(preview.summary.deductibleVat)}
          helper="Factures fournisseurs et écritures 3455 incluses."
          icon={Landmark}
          tone="emerald"
        />
        <SummaryCard
          title="Solde estimé"
          value={formatMoney(preview.summary.estimatedBalance)}
          helper="TVA collectée moins TVA récupérable."
          icon={FileSpreadsheet}
          tone={preview.summary.estimatedBalance >= 0 ? "purple" : "amber"}
        />
        <SummaryCard
          title="Pièces incluses"
          value={String(preview.summary.includedDocumentsCount)}
          helper={`${preview.summary.customerInvoicesCount} client(s), ${preview.summary.supplierInvoicesCount} fournisseur(s).`}
          icon={FileText}
          tone="slate"
        />
        <SummaryCard
          title="Anomalies"
          value={String(preview.summary.warningIssuesCount + preview.summary.blockingIssuesCount)}
          helper={`${preview.summary.controlsCount} contrôles exécutés.`}
          icon={AlertTriangle}
          tone={preview.summary.warningIssuesCount + preview.summary.blockingIssuesCount > 0 ? "rose" : "emerald"}
        />
        <SummaryCard
          title="Export prêt"
          value={preview.summary.isReady ? "Oui" : "À contrôler"}
          helper={preview.summary.lastExportLabel ? `Dernier export : ${preview.summary.lastExportLabel}` : "Aucun export archivé."}
          icon={CheckCircle2}
          tone={preview.summary.isReady ? "emerald" : "amber"}
        />
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.03em] text-[var(--muted)]">Paramètres de l&apos;export</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Les filtres sont conservés dans l&apos;URL pour faciliter les contrôles de période.</p>
          </div>
          <Link
            href="/comptabilite/tva/exports"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--secondary)] hover:bg-[var(--surface-soft)]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Réinitialiser
          </Link>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Date début
              <Input type="date" name="from" defaultValue={searchValue(preview.filters.from)} />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Date fin
              <Input type="date" name="to" defaultValue={searchValue(preview.filters.to)} />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Type d&apos;export
              <Select name="type" defaultValue={preview.filters.type}>
                {exportTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Régime TVA
              <Select name="regime" defaultValue={preview.filters.regime}>
                <option value="monthly">Mensuel</option>
                <option value="quarterly">Trimestriel</option>
                <option value="annual">Annuel / contrôle</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Source
              <Select name="source" defaultValue={preview.filters.source}>
                <option value="all">Toutes</option>
                <option value="customer_invoices">Factures clients</option>
                <option value="supplier_invoices">Factures fournisseurs</option>
                <option value="accounting_entries">Écritures comptables</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Statut des pièces
              <Select name="status" defaultValue={preview.filters.status}>
                <option value="all">Toutes</option>
                <option value="validated">Validées</option>
                <option value="posted">Comptabilisées</option>
                <option value="not_posted">Non comptabilisées</option>
                <option value="anomaly">Avec anomalie</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Format
              <Select name="format" defaultValue={preview.filters.format}>
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="dgi">Dossier DGI TVA préparatoire</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Recherche
              <Input name="q" placeholder="Numéro, tiers, ICE..." defaultValue={searchValue(preview.filters.q)} />
            </label>
            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
              <Button type="submit">
                <Calendar className="h-4 w-4" />
                Prévisualiser
              </Button>
              <Link
                href={exportHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--secondary)] shadow-[var(--shadow-sm)] transition-all hover:border-[#c8d0e1] hover:bg-[var(--surface-soft)]"
              >
                <Download className="h-4 w-4" />
                Exporter CSV
              </Link>
              <Button type="button" variant="secondary" disabled className="cursor-not-allowed">
                Exporter Excel
                <Badge tone="warning">Bientôt</Badge>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div id="generation-dgi-tva" className="mb-6">
      <Card className="border-emerald-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fffb_100%)]">
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.03em] text-[var(--muted)]">Génération DGI TVA</h3>
              <Badge tone="info">Préparatoire</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">
              Cet export prépare les données TVA à contrôler avant déclaration. Le format officiel DGI final doit être validé selon les modèles en vigueur.
            </p>
          </div>
          <Badge tone={preview.summary.blockingIssuesCount > 0 ? "danger" : preview.summary.warningIssuesCount > 0 ? "warning" : "success"}>
            {preview.summary.blockingIssuesCount > 0 ? "Bloqué" : preview.summary.warningIssuesCount > 0 ? "À contrôler" : "Prêt pour déclaration"}
          </Badge>
        </CardHeader>
        <CardContent>
          <form action={generateDgiVatPreparationAction} className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Période du
              <Input type="date" name="period_start" defaultValue={searchValue(preview.filters.from)} required />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Période au
              <Input type="date" name="period_end" defaultValue={searchValue(preview.filters.to)} required />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Régime
              <Select name="regime" defaultValue={preview.filters.regime}>
                <option value="monthly">Mensuel</option>
                <option value="quarterly">Trimestriel</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
              Format
              <Select name="format" defaultValue="csv">
                <option value="csv">CSV préparatoire</option>
                <option value="xlsx" disabled>Excel, bientôt disponible</option>
              </Select>
            </label>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-3">
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input type="checkbox" name="include_customer_invoices" defaultChecked />
                Inclure factures clients
              </label>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-3">
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input type="checkbox" name="include_supplier_invoices" defaultChecked />
                Inclure factures fournisseurs
              </label>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-3">
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input type="checkbox" name="include_accounting_entries" defaultChecked />
                Inclure écritures comptables
              </label>
            </div>
            <div className="flex items-center lg:justify-end">
              <Button type="submit" className="w-full lg:w-auto">
                <FileSpreadsheet className="h-4 w-4" />
                Générer dossier DGI TVA
              </Button>
            </div>
          </form>
          <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-[var(--muted)] md:grid-cols-4">
            <div className="rounded-[var(--radius-md)] bg-white p-3">Lignes TVA : <span className="font-semibold text-[var(--foreground)]">{preview.rows.length}</span></div>
            <div className="rounded-[var(--radius-md)] bg-white p-3">TVA collectée : <span className="font-semibold text-[var(--foreground)]">{formatMoney(preview.summary.collectedVat)}</span></div>
            <div className="rounded-[var(--radius-md)] bg-white p-3">TVA récupérable : <span className="font-semibold text-[var(--foreground)]">{formatMoney(preview.summary.deductibleVat)}</span></div>
            <div className="rounded-[var(--radius-md)] bg-white p-3">Anomalies : <span className="font-semibold text-[var(--foreground)]">{preview.summary.warningIssuesCount + preview.summary.blockingIssuesCount}</span></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
            Felexia prépare les données TVA pour contrôle et déclaration. Le dépôt officiel reste effectué sur les services DGI selon les modalités en vigueur.
          </p>
        </CardContent>
      </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold uppercase tracking-[0.03em] text-[var(--muted)]">Lignes incluses dans l&apos;export</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Prévisualisation limitée aux 100 premières lignes pour garder l&apos;écran lisible.</p>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="Aucune ligne exportable"
                  description="Aucune facture ou écriture TVA ne correspond aux filtres sélectionnés."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-left text-sm text-[var(--foreground)]">
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Type pièce</Th>
                      <Th>Numéro</Th>
                      <Th>Tiers</Th>
                      <Th>ICE</Th>
                      <Th>Base HT</Th>
                      <Th>Taux</Th>
                      <Th>TVA</Th>
                      <Th>TTC</Th>
                      <Th>Statut</Th>
                      <Th>Compta</Th>
                      <Th>Observation</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <Td>{safeDate(row.documentDate)}</Td>
                        <Td>
                          <div className="font-medium">{row.documentType}</div>
                          <div className="text-xs text-[var(--muted)]">{row.sourceLabel}</div>
                        </Td>
                        <Td className="font-medium">{row.documentNumber}</Td>
                        <Td>{row.thirdPartyName ?? "-"}</Td>
                        <Td>{row.thirdPartyIce ?? "-"}</Td>
                        <Td className="text-right tabular-nums">{formatMoney(row.baseHt)}</Td>
                        <Td className="text-right tabular-nums">{row.taxRate === null ? "-" : `${row.taxRate}%`}</Td>
                        <Td className="text-right font-medium tabular-nums">{formatMoney(row.vatAmount)}</Td>
                        <Td className="text-right tabular-nums">{row.totalTtc > 0 ? formatMoney(row.totalTtc) : "-"}</Td>
                        <Td><Badge tone={statusTone(row.documentStatus)}>{row.documentStatus ?? "-"}</Badge></Td>
                        <Td><Badge tone={row.accountingStatus === "Comptabilisée" ? "success" : "warning"}>{row.accountingStatus ?? "-"}</Badge></Td>
                        <Td className="max-w-[220px] text-xs text-[var(--muted)]">{row.observation ?? "-"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold uppercase tracking-[0.03em] text-[var(--muted)]">Contrôles avant export</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Les contrôles n&apos;empêchent pas l&apos;export CSV de travail, mais sécurisent la préparation.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {preview.controls.map((control) => (
              <div key={control.key} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)]">{control.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{control.message}</p>
                  </div>
                  <Badge tone={controlTone(control)}>
                    {control.severity === "ok" ? "OK" : control.severity === "blocking" ? "Bloquant" : "Attention"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--muted)]">{control.count} pièce(s) concernée(s)</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold uppercase tracking-[0.03em] text-[var(--muted)]">Historique des exports</h3>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="rounded-none border-x-0 border-b-0 shadow-none">
              <thead>
                <tr>
                  <Th>Numéro export</Th>
                  <Th>Période</Th>
                  <Th>Type</Th>
                    <Th>Régime</Th>
                    <Th>Format</Th>
                    <Th>Statut</Th>
                    <Th>Solde</Th>
                    <Th>Généré le</Th>
                    <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {preview.exportHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="border-t border-[var(--border)] px-4 py-8">
                      <EmptyState
                        title="Aucun export archivé"
                        description="Les exports TVA générés et archivés apparaîtront ici après application de la migration."
                      />
                    </td>
                  </tr>
                ) : preview.exportHistory.map((batch) => (
                  <tr key={batch.id}>
                    <Td className="font-medium">{batch.export_number}</Td>
                    <Td>{batch.period_start || batch.period_end ? `${safeDate(batch.period_start)} - ${safeDate(batch.period_end)}` : "-"}</Td>
                    <Td>{batch.export_type}</Td>
                    <Td>{batch.regime ?? "-"}</Td>
                    <Td>{batch.format.toUpperCase()}</Td>
                    <Td><Badge tone={statusTone(batch.status)}>{statusLabel(batch.status)}</Badge></Td>
                    <Td>{typeof batch.totals?.estimatedBalance === "number" ? formatMoney(batch.totals.estimatedBalance) : "-"}</Td>
                    <Td>{safeDate(batch.generated_at)}</Td>
                    <Td>
                      {batch.file_path ? (
                        <Link
                          href={`/comptabilite/tva/exports/${batch.id}/download`}
                          className="inline-flex h-8 items-center justify-center rounded-[var(--radius-md)] px-2 text-xs font-medium text-[var(--secondary)] hover:bg-[var(--primary-soft)]"
                        >
                          Télécharger
                        </Link>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">Aucun fichier</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-slate-100 text-slate-600">
                <FileSpreadsheet className="h-6 w-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[var(--foreground)]">Dossier DGI TVA préparatoire</h3>
                  <Badge tone="info">Préparatoire</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Cette génération produit un dossier de contrôle exploitable en CSV : synthèse, TVA collectée, TVA récupérable, relevé des déductions et anomalies. Elle ne vaut pas dépôt officiel DGI.
                </p>
                <a href="#generation-dgi-tva" className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--secondary)] shadow-[var(--shadow-sm)] transition-all hover:bg-[var(--surface-soft)]">
                  Préparer le dossier
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePage>
  );
}
