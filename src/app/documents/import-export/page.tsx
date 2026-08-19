import { CheckCircle2, Clock3, Download, FileSpreadsheet, FileText, ImageIcon, UploadCloud, XCircle } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { DOCUMENT_SOURCE_MODULES, DOCUMENT_STATUSES, DOCUMENT_TYPES } from "@/lib/documents";

const acceptedFormats = [
  { label: "PDF", icon: FileText },
  { label: "Word", icon: FileText },
  { label: "Excel", icon: FileSpreadsheet },
  { label: "Images", icon: ImageIcon },
  { label: "CSV", icon: FileSpreadsheet },
];

const exportFormats = [
  { value: "csv", label: "CSV" },
];

const historyRows: Array<{
  date: string;
  operation: string;
  format: string;
  files: number;
  status: "Terminé" | "En cours" | "Échec";
  user: string;
}> = [];

function statusTone(status: string): "success" | "warning" | "danger" {
  if (status === "Terminé") return "success";
  if (status === "Échec") return "danger";
  return "warning";
}

function statusIcon(status: string) {
  if (status === "Terminé") return CheckCircle2;
  if (status === "Échec") return XCircle;
  return Clock3;
}

export default function DocumentsImportExportPage() {
  return (
    <ModulePage>
      <PageHeader
        title="Import / Export"
        description="Préparez les imports manuels et les exports de documents de votre entreprise."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-[var(--secondary)]">
                <UploadCloud className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Importer des documents</h2>
                <p className="text-sm text-[var(--muted)]">Ajoutez des fichiers et préparez leur classement documentaire.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {acceptedFormats.map((format) => {
                  const Icon = format.icon;
                  return (
                    <span key={format.label} className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">
                      <Icon className="h-3.5 w-3.5" />
                      {format.label}
                    </span>
                  );
                })}
              </div>

              <DocumentUploadForm />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-[var(--secondary)]">
                <Download className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Exporter les documents</h2>
                <p className="text-sm text-[var(--muted)]">Préparez un lot selon les filtres documentaires.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form action="/documents/export" className="space-y-4">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Type de document</span>
                <Select name="type">
                  <option value="">Tous les types</option>
                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Module source</span>
                <Select name="module">
                  <option value="">Tous les modules</option>
                  {DOCUMENT_SOURCE_MODULES.map((module) => <option key={module.value} value={module.value}>{module.label}</option>)}
                </Select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[var(--muted)]">Date début</span>
                  <Input type="date" name="dateFrom" />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[var(--muted)]">Date fin</span>
                  <Input type="date" name="dateTo" />
                </label>
              </div>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Statut</span>
                <Select name="status">
                  <option value="">Tous les statuts</option>
                  {DOCUMENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Format d&apos;export</span>
                <Select name="format" defaultValue="csv">
                  {exportFormats.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}
                </Select>
              </label>

              <p className="rounded-[var(--radius-md)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--muted)]">
                Le fichier CSV est généré et téléchargé immédiatement avec les filtres choisis.
              </p>

              <div className="flex justify-end">
                <Button type="submit">
                  <Download className="h-4 w-4" />
                  Exporter
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <h2 className="font-semibold">Historique Import / Export</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Opération</Th>
                <Th>Format</Th>
                <Th>Nombre de fichiers</Th>
                <Th>Statut</Th>
                <Th>Lancé par</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {historyRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                    Aucun import ou export lancé pour le moment.
                  </td>
                </tr>
              ) : historyRows.map((row) => {
                const Icon = statusIcon(row.status);
                return (
                  <tr key={`${row.date}-${row.operation}`}>
                    <Td>{row.date}</Td>
                    <Td>{row.operation}</Td>
                    <Td>{row.format}</Td>
                    <Td>{row.files}</Td>
                    <Td>
                      <Badge tone={statusTone(row.status)} className="gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {row.status}
                      </Badge>
                    </Td>
                    <Td>{row.user}</Td>
                    <Td>
                      <button type="button" className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--secondary)]">
                        <Download className="h-4 w-4" />
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </ModulePage>
  );
}
