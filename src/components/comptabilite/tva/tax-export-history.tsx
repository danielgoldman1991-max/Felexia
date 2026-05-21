import Link from "next/link";
import type { ReactNode } from "react";
import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import type { DgiVatExportHistoryRow } from "@/lib/tax/dgi-vat-types";

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "generated") return "success";
  if (status === "generated_with_warnings" || status === "downloaded") return "warning";
  if (status === "preflight_failed" || status === "failed" || status === "blocked") return "danger";
  return "info";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Brouillon",
    preflight_failed: "Pré-contrôle échoué",
    ready_to_generate: "Prêt",
    generated: "Généré",
    generated_with_warnings: "Généré avec alertes",
    downloaded: "Téléchargé",
    superseded: "Remplacé",
    archived: "Archivé",
    failed: "Échec",
  };
  return labels[status] ?? status;
}

function amount(row: DgiVatExportHistoryRow, key: string) {
  const value = row.totals?.[key];
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

function FileLink({ id, file, available, children }: { id: string; file: string; available: boolean; children: ReactNode }) {
  if (!available) return <span className="text-xs text-[var(--muted)]">-</span>;
  return (
    <Link href={`/comptabilite/tva/exports/${id}/download?file=${file}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--secondary)] hover:underline">
      <Download className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

export function TaxExportHistory({ history }: { history: DgiVatExportHistoryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-[var(--foreground)]">Historique des exports</h2>
        <p className="text-sm text-[var(--muted)]">Chaque génération est historisée avec ses fichiers privés et son rapport de validation.</p>
      </CardHeader>
      <CardContent>
        <Table>
          <thead>
            <tr>
              <Th>Période</Th>
              <Th>Fréquence</Th>
              <Th>Statut</Th>
              <Th>TVA collectée</Th>
              <Th>TVA déductible</Th>
              <Th>Fichiers</Th>
              <Th>Généré le</Th>
              <Th>Téléchargements</Th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={8} className="border-t border-[var(--border)] px-4 py-3.5 text-center text-[var(--muted)]">Aucun export TVA préparatoire historisé.</td></tr>
            ) : history.map((row) => (
              <tr key={row.id}>
                <Td>{formatDate(row.period_start)} - {formatDate(row.period_end)}</Td>
                <Td>{row.frequency === "quarterly" ? "Trimestrielle" : "Mensuelle"}</Td>
                <Td><Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge></Td>
                <Td className="text-right">{formatMoney(amount(row, "collectedVatMad"))}</Td>
                <Td className="text-right">{formatMoney(amount(row, "deductibleVatMad"))}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <FileLink id={row.id} file="xml" available={Boolean(row.xml_path)}><FileText className="h-3.5 w-3.5" />XML</FileLink>
                    <FileLink id={row.id} file="csv" available={Boolean(row.csv_path)}><FileSpreadsheet className="h-3.5 w-3.5" />CSV</FileLink>
                    <FileLink id={row.id} file="manifest" available={Boolean(row.manifest_path)}><FileJson className="h-3.5 w-3.5" />Manifest</FileLink>
                    <FileLink id={row.id} file="validation" available={Boolean(row.validation_report_path)}><FileJson className="h-3.5 w-3.5" />Contrôles</FileLink>
                  </div>
                </Td>
                <Td>{row.generated_at ? formatDate(row.generated_at) : formatDate(row.created_at)}</Td>
                <Td>{row.download_count ?? 0}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CardContent>
    </Card>
  );
}
