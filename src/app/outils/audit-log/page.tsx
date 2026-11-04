import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { auditActionLabel, auditTableLabel } from "@/lib/audit-labels";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; user?: string; action?: string; table?: string }> }) {
  const filters = await searchParams;
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  let query = supabase.from("audit_logs").select("id, action, table_name, record_id, created_at, actor_id, changes").eq("organization_id", workspace.organization.id).order("created_at", { ascending: false }).limit(200);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);
  if (filters.action) query = query.ilike("action", `%${filters.action}%`);
  if (filters.table) query = query.eq("table_name", filters.table);
  const { data } = await query;
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || profile.email || profile.id]));
  const visible = filters.user
    ? rows.filter((row) => (names.get(row.actor_id) ?? "").toLowerCase().includes(filters.user!.toLowerCase()))
    : rows;
  const exportHref = `/outils/audit-log/export?${new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])))}`;
  return (
    <ModulePage>
      <PageHeader title="Journal d'audit" description="Heure, utilisateur et libellé des actions. Les identifiants techniques restent dans l'export si besoin." actions={<Link className="text-sm font-semibold text-[var(--primary)]" href={exportHref}>Exporter CSV</Link>} />
      <form className="mb-4 flex flex-wrap gap-2 text-sm" method="get">
        <input name="from" type="date" defaultValue={filters.from} aria-label="Depuis" className="h-10 rounded border border-[var(--border)] px-2" />
        <input name="to" type="date" defaultValue={filters.to} aria-label="Jusqu'au" className="h-10 rounded border border-[var(--border)] px-2" />
        <input name="user" defaultValue={filters.user} placeholder="Utilisateur" className="h-10 rounded border border-[var(--border)] px-2" />
        <input name="action" defaultValue={filters.action} placeholder="Action" className="h-10 rounded border border-[var(--border)] px-2" />
        <input name="table" defaultValue={filters.table} placeholder="Table" className="h-10 rounded border border-[var(--border)] px-2" />
        <button className="h-10 rounded bg-[var(--primary)] px-3 font-medium text-white" type="submit">Filtrer</button>
      </form>
      {visible.length === 0 ? (
        <EmptyState title="Aucune trace" description="Les créations de factures, la paie, les rapprochements, les salariés et les invitations apparaîtront ici." />
      ) : (
        <Table>
          <thead><tr><Th>Date et heure</Th><Th>Utilisateur</Th><Th>Action</Th><Th>Élément</Th><Th>Détail</Th></tr></thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <Td>{new Date(row.created_at).toLocaleString("fr-MA", { dateStyle: "short", timeStyle: "short" })}</Td>
                <Td>{names.get(row.actor_id) ?? "Système"}</Td>
                <Td>{auditActionLabel(row.action)}</Td>
                <Td>{auditTableLabel(row.table_name)}</Td>
                <Td>{summarize(row.changes)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}

function summarize(changes: unknown) {
  if (!changes || typeof changes !== "object") return "—";
  const record = changes as Record<string, unknown>;
  const name = record.name ?? record.full_name ?? record.email ?? record.code ?? record.title;
  return name ? String(name) : "—";
}
