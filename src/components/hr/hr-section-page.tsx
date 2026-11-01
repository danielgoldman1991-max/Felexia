import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Table, Td, Th } from "@/components/ui/table";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import { HrManagementAction } from "@/components/hr/hr-management-action";

type Row = Record<string, string | number | boolean | null>;
type DetailBasePath = "/rh/contrats" | "/rh/paie/periodes" | "/rh/paie/bulletins";
const detailBases = new Set<DetailBasePath>(["/rh/contrats", "/rh/paie/periodes", "/rh/paie/bulletins"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function HrSectionPage({
  title,
  description,
  rows,
  columns,
  newHref,
  detailBasePath,
  notice = false,
}: {
  title: string;
  description: string;
  rows: Row[];
  columns: Array<{ key: string; label: string; money?: boolean; status?: boolean }>;
  newHref?: string;
  detailBasePath?: DetailBasePath;
  notice?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={newHref ? (
          <HrManagementAction>
          <Link href={newHref} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] transition hover:brightness-110">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau
          </Link>
          </HrManagementAction>
        ) : null}
      />
      {notice ? <HrPreparatoryNotice /> : null}
      {!newHref ? <p className="text-sm text-[var(--muted)]">Vue de consultation. Les actions de création et d’approbation ne sont pas proposées sur cet écran.</p> : null}
      <div className="premium-card p-5">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 text-center">
            <p className="text-lg font-medium">Aucune donnée RH pour le moment.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{newHref ? "Utilisez le bouton Nouveau pour compléter votre dossier." : "Les informations enregistrées apparaîtront dans cette vue de consultation."}</p>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>{columns.map((column) => <Th key={column.key}>{column.label}</Th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const detailHref = detailBasePath && detailBases.has(detailBasePath) && uuid.test(String(row.id)) ? `${detailBasePath}/${row.id}` : null;
                return (
                <tr key={String(row.id)}>
                  {columns.map((column, index) => (
                    <Td key={column.key}>
                      {column.money ? (
                        <MoneyDisplay value={Number(row[column.key] ?? 0)} />
                      ) : column.status ? (
                        <StatusBadge status={String(row[column.key] ?? "draft")} />
                      ) : index === 0 && detailHref ? (
                        <Link href={detailHref} className="font-medium text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">{String(row[column.key] ?? "Voir le détail")}</Link>
                      ) : (
                        String(row[column.key] ?? "-")
                      )}
                    </Td>
                  ))}
                </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
