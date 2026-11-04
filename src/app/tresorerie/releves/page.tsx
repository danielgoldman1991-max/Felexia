import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/erp/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { listBankStatementImports } from "@/lib/treasury";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BankStatementImportsPage() {
  const imports = await listBankStatementImports();
  return (
    <ModulePage>
      <PageHeader
        title="Relevés bancaires"
        description="Importez un fichier pour rapprocher les lignes avec les mouvements de trésorerie."
        actions={<Button asChild><Link href="/tresorerie/releves/import">Importer un relevé</Link></Button>}
      />
      {imports.length === 0 ? (
        <EmptyState title="Aucun relevé importé" description="Importez un fichier pour rapprocher les lignes avec les mouvements de trésorerie." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Fichier</Th>
              <Th>Compte</Th>
              <Th>Statut</Th>
              <Th className="right">Lignes</Th>
              <Th>Importé le</Th>
            </tr>
          </thead>
          <tbody>
            {imports.map((item) => (
              <tr key={item.id}>
                <Td><Link href={`/tresorerie/releves/${item.id}`}>{item.import_code || item.file_name}</Link></Td>
                <Td>{item.file_name}</Td>
                <Td>{item.account_name || "—"}</Td>
                <Td>{item.status}</Td>
                <Td className="right">{item.imported_lines_count}</Td>
                <Td>{formatDate(item.imported_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
