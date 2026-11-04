import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { loadAuditRows, type AuditFilters } from "@/lib/audit-log-query";

export async function AuditLogScreen({ filters, exportHref }: { filters: AuditFilters; exportHref: string }) {
  const rows = await loadAuditRows(filters);
  return (
    <ModulePage>
      <PageHeader title="Journal d'audit" description="Heure de Casablanca, utilisateur et libellé. Les identifiants techniques ne sont pas affichés." actions={<Link className="text-sm font-semibold text-[var(--primary)]" href={exportHref}>Exporter CSV</Link>} />
      <form className="mb-4 flex flex-wrap gap-2 text-sm" method="get">
        <input name="from" type="date" defaultValue={filters.from} aria-label="Depuis" className="h-10 rounded border border-[var(--border)] px-2" />
        <input name="to" type="date" defaultValue={filters.to} aria-label="Jusqu'au" className="h-10 rounded border border-[var(--border)] px-2" />
        <input name="user" defaultValue={filters.user} placeholder="Utilisateur" aria-label="Utilisateur" className="h-10 rounded border border-[var(--border)] px-2" />
        <input name="action" defaultValue={filters.action} placeholder="Action" aria-label="Action" className="h-10 rounded border border-[var(--border)] px-2" />
        <input name="table" defaultValue={filters.table} placeholder="Table" aria-label="Table" className="h-10 rounded border border-[var(--border)] px-2" />
        <button className="h-10 rounded bg-[var(--primary)] px-3 font-medium text-white" type="submit">Filtrer</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Aucune trace" description="Les créations de factures, la paie, les rapprochements, les salariés et les invitations apparaîtront ici." />
      ) : (
        <Table>
          <thead><tr><Th>Date et heure</Th><Th>Utilisateur</Th><Th>Action</Th><Th>Élément</Th><Th>Détail</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td>{row.when}</Td>
                <Td>{row.user}</Td>
                <Td>{row.action}</Td>
                <Td>{row.table}</Td>
                <Td>{row.detail}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
