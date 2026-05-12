import Link from "next/link";
import { Eye, Plus, RefreshCw, XCircle } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { cancelBankStatementImport } from "@/lib/treasury-actions";
import { listBankStatementImports } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export default async function BankStatementImportsPage() {
  const rows = await listBankStatementImports();
  async function cancelImportAction(formData: FormData) {
    "use server";
    await cancelBankStatementImport({ success: true }, formData);
  }
  const statusLabels: Record<string, string> = {
    imported: "Importe",
    partially_reconciled: "Partiellement rapproche",
    reconciled: "Rapproche",
    cancelled: "Annule",
  };
  return (
    <ModulePage>
      <PageHeader
        title="Releves bancaires"
        description="Suivez les imports de releves et leurs lignes non rapprochees."
        actions={<Link href="/tresorerie/releves/import"><Button><Plus className="h-4 w-4" /> Import releve</Button></Link>}
      />
      <Card><CardContent>
        {rows.length === 0 ? <EmptyState title="Aucun releve importe." description="Importez un CSV bancaire pour lancer le rapprochement." /> : (
          <Table>
            <thead><tr><Th>Code import</Th><Th>Compte bancaire</Th><Th>Nom fichier</Th><Th>Periode</Th><Th>Date import</Th><Th>Lignes</Th><Th>Rapprochees</Th><Th>Non rapprochees</Th><Th>Statut</Th><Th>Actions</Th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <Td>{row.import_code ?? "Ancien import"}</Td>
                <Td>{row.account_name ?? row.treasury_account_id}</Td>
                <Td><Link href={`/tresorerie/releves/${row.id}`} className="font-medium text-indigo-700 hover:underline">{row.file_name}</Link></Td>
                <Td>{row.period_start && row.period_end ? `${row.period_start} - ${row.period_end}` : "-"}</Td>
                <Td>{row.imported_at?.slice(0, 10)}</Td>
                <Td>{row.imported_lines_count}</Td>
                <Td>{row.matched_lines_count}</Td>
                <Td>{row.unmatched_lines_count}</Td>
                <Td><Badge tone={row.status === "reconciled" ? "success" : row.status === "cancelled" ? "danger" : "neutral"}>{statusLabels[row.status] ?? row.status}</Badge></Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Link href={`/tresorerie/releves/${row.id}`}><Button type="button" variant="ghost" className="h-8 px-2"><Eye className="h-4 w-4" /></Button></Link>
                    <Link href={`/tresorerie/rapprochement?accountId=${row.treasury_account_id}`}><Button type="button" variant="ghost" className="h-8 px-2"><RefreshCw className="h-4 w-4" /></Button></Link>
                    {row.status !== "cancelled" ? (
                      <form action={cancelImportAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <Button type="submit" variant="danger" className="h-8 px-2"><XCircle className="h-4 w-4" /></Button>
                      </form>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </CardContent></Card>
    </ModulePage>
  );
}
