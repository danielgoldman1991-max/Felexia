import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { listStockProductsForSelect } from "@/lib/stock";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const products = await listStockProductsForSelect();
  const stockable = products.filter((product) => product.track_stock);
  const lowStock = stockable.filter((product) => product.current_stock <= product.min_stock);
  const totalStock = stockable.reduce((sum, product) => sum + Number(product.current_stock ?? 0), 0);

  return (
    <ModulePage>
      <PageHeader
        title="Vue stock"
        description="Synthese des articles stockables et acces rapide aux mouvements."
        actions={(
          <>
            <Link href="/stock/mouvements"><Button type="button" variant="secondary">Mouvements par article</Button></Link>
            <Link href="/stock/entrees/new"><Button type="button">Entree manuelle</Button></Link>
          </>
        )}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Articles" value={products.length} />
        <StatCard title="Articles suivis" value={stockable.length} />
        <StatCard title="Alertes stock" value={lowStock.length} />
      </div>
      <Card className="mt-5">
        <CardContent className="text-sm text-[var(--muted)]">
          Stock total quantitatif suivi : <span className="font-semibold text-[var(--foreground)]">{formatNumber(totalStock)}</span>.
          Utilisez la page mouvements pour consulter l&apos;historique complet article par article.
        </CardContent>
      </Card>
    </ModulePage>
  );
}
