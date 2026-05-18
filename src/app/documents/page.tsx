import Link from "next/link";
import { Archive, Download, Eye, FileText, FolderOpen, Pencil, Search, Trash2, UploadCloud } from "lucide-react";
import { EmptyState } from "@/components/erp/empty-state";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { archiveDocumentAction, deleteDocumentAction } from "@/lib/document-actions";
import {
  DOCUMENT_SOURCE_MODULES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  getDocumentStatusLabel,
  listUnifiedDocuments,
} from "@/lib/documents";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type DocumentsSearchParams = Promise<{
  q?: string;
  type?: string;
  module?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

function safeDate(value: string | null) {
  return value ? formatDate(value) : "-";
}

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "available") return "success";
  if (status === "validated") return "info";
  if (status === "draft") return "warning";
  if (status === "deleted") return "danger";
  return "neutral";
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof FileText }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-[var(--secondary)]">
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default async function DocumentsPage({ searchParams }: { searchParams: DocumentsSearchParams }) {
  const params = await searchParams;
  const result = await listUnifiedDocuments({
    query: params.q,
    documentType: params.type,
    sourceModule: params.module,
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  return (
    <ModulePage>
      <PageHeader
        title="Tous les documents"
        description="Bibliothèque documentaire centralisée de votre entreprise."
        actions={
          <>
            <Link
              href="/documents/export"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--secondary)] shadow-[var(--shadow-sm)] transition-all hover:border-[#c8d0e1] hover:bg-[var(--surface-soft)]"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Link>
            <Link
              href="/documents/import-export"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-all hover:bg-[#6840dc]"
            >
              <UploadCloud className="h-4 w-4" />
              Importer un document
            </Link>
          </>
        }
      />

      <div className="space-y-5">
        {result.setupMissing ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="text-sm text-amber-800">
              La table documents n&apos;est pas encore disponible. Appliquez les migrations Supabase pour activer le module Documents.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total documents" value={result.stats.total} icon={FolderOpen} />
          <StatCard label="Documents générés" value={result.stats.generated} icon={FileText} />
          <StatCard label="Documents importés" value={result.stats.imported} icon={UploadCloud} />
          <StatCard label="Documents archivés" value={result.stats.archived} icon={Archive} />
        </div>

        <Card>
          <CardContent>
            <form className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_0.85fr_0.85fr_auto]">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Recherche</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                  <Input name="q" defaultValue={params.q ?? ""} placeholder="Nom ou référence" className="pl-9" />
                </div>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Type</span>
                <Select name="type" defaultValue={params.type ?? ""}>
                  <option value="">Tous</option>
                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Module</span>
                <Select name="module" defaultValue={params.module ?? ""}>
                  <option value="">Tous</option>
                  {DOCUMENT_SOURCE_MODULES.map((module) => <option key={module.value} value={module.value}>{module.label}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Statut</span>
                <Select name="status" defaultValue={params.status ?? ""}>
                  <option value="">Tous</option>
                  {DOCUMENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Date début</span>
                <Input type="date" name="dateFrom" defaultValue={params.dateFrom ?? ""} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium text-[var(--muted)]">Date fin</span>
                <Input type="date" name="dateTo" defaultValue={params.dateTo ?? ""} />
              </label>
              <div className="flex items-end gap-2">
                <Button type="submit">Filtrer</Button>
                <Link
                  href="/documents"
                  className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--secondary)] shadow-[var(--shadow-sm)] transition-all hover:border-[#c8d0e1] hover:bg-[var(--surface-soft)]"
                >
                  Réinitialiser
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {result.rows.length === 0 ? (
          <EmptyState
            title="Aucun document trouvé"
            description="Les documents générés ou importés apparaîtront ici."
            action={
              <Link
                href="/documents/import-export"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-all hover:bg-[#6840dc]"
              >
                <UploadCloud className="h-4 w-4" />
                Importer un document
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Numéro</Th>
                <Th>Titre</Th>
                <Th>Tiers</Th>
                <Th>Statut</Th>
                <Th>Date</Th>
                <Th>Total TTC</Th>
                <Th>Source</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((document) => (
                <tr key={document.id}>
                  <Td>{document.document_type_label}</Td>
                  <Td>{document.document_number ?? "-"}</Td>
                  <Td>
                    <div className="min-w-[200px]">
                      <p className="font-medium">{document.title}</p>
                      {document.file_name ? <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">{document.file_name}</p> : null}
                    </div>
                  </Td>
                  <Td>{document.third_party_name ?? "-"}</Td>
                  <Td><Badge tone={statusTone(document.status ?? "")}>{getDocumentStatusLabel(document.status)}</Badge></Td>
                  <Td>{safeDate(document.issue_date)}</Td>
                  <Td>{document.total_ttc === null ? "-" : `${document.total_ttc.toLocaleString("fr-MA", { minimumFractionDigits: 2 })} DH`}</Td>
                  <Td>{document.source_label}</Td>
                  <Td>
                    <div className="flex min-w-[180px] flex-wrap gap-2">
                      {document.print_url ? (
                        <Link href={document.print_url} target="_blank" className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--secondary)]" aria-label="Voir">
                          <Eye className="h-4 w-4" />
                        </Link>
                      ) : (
                        <button type="button" className="rounded-md p-2 text-[var(--muted)] opacity-50" aria-label="Voir" disabled><Eye className="h-4 w-4" /></button>
                      )}
                      {document.source === "upload" && document.print_url ? (
                        <Link href={document.print_url} className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--secondary)]" aria-label="Télécharger">
                          <Download className="h-4 w-4" />
                        </Link>
                      ) : (
                        <button type="button" className="rounded-md p-2 text-[var(--muted)] opacity-50" aria-label="Télécharger" disabled><Download className="h-4 w-4" /></button>
                      )}
                      {document.source === "upload" ? (
                        <>
                          <button type="button" className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--secondary)]" aria-label="Modifier les informations">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <form action={archiveDocumentAction}>
                            <input type="hidden" name="id" value={document.source_id} />
                            <button type="submit" className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--secondary)]" aria-label="Archiver">
                              <Archive className="h-4 w-4" />
                            </button>
                          </form>
                          <form action={deleteDocumentAction}>
                            <input type="hidden" name="id" value={document.source_id} />
                            <button type="submit" className="rounded-md p-2 text-[var(--danger)] hover:bg-[var(--danger-soft)]" aria-label="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </ModulePage>
  );
}
