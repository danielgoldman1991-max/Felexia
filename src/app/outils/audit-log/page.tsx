import { requireActiveWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, table_name, record_id, created_at, actor_id")
    .eq("organization_id", workspace.organization.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = data ?? [];
  return (
    <ModulePage>
      <PageHeader title="Journal d'audit" description="Cent dernières actions enregistrées pour cette entreprise." />
      {rows.length === 0 ? (
        <EmptyState title="Aucune trace" description="Les créations de factures, validations, transferts de stock et lettrages apparaîtront ici." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Action</Th>
              <Th>Table</Th>
              <Th>Enregistrement</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td>{formatDate(row.created_at)}</Td>
                <Td>{row.action}</Td>
                <Td>{row.table_name}</Td>
                <Td>{row.record_id || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
