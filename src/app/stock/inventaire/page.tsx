import Link from "next/link";
import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteProWorkspace } from "@/lib/pro-access";
import { listStockProductsForSelect } from "@/lib/stock";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/erp/empty-state";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const canWrite = canWriteProWorkspace(await requireActiveWorkspace());
  const products = (await listStockProductsForSelect()).filter((product) => product.track_stock);
  const lowStock = products.filter((product) => product.current_stock <= product.min_stock);

  return (
    <ModulePage>
      <PageHeader
        title="Inventaire"
        description="Articles sous le seuil, et accès aux ajustements qui corrigent le stock."
        actions={canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild><Link href="/stock/transferts">Transférer</Link></Button>
            <Button asChild><Link href="/stock/ajustements/new">Nouvel ajustement</Link></Button>
          </div>
        ) : null}
      />
      {lowStock.length === 0 ? (
        <EmptyState title="Aucune alerte de seuil" description="Les articles suivis sont au-dessus de leur stock minimum." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Article</Th>
              <Th className="right">Stock</Th>
              <Th className="right">Seuil</Th>
            </tr>
          </thead>
          <tbody>
            {lowStock.map((product) => (
              <tr key={product.id}>
                <Td>{product.name}</Td>
                <Td className="right">{formatNumber(product.current_stock)}</Td>
                <Td className="right">{formatNumber(product.min_stock)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </ModulePage>
  );
}
