import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatCard } from "@/components/erp/stat-card";
import { StockLocationsTable } from "@/components/stock/stock-locations-table";
import { getStockLocationCounters, listStockLocations } from "@/lib/stock-locations";

export const dynamic = "force-dynamic";

export default async function StockLocationsPage() {
  const [rows, counters] = await Promise.all([listStockLocations(), getStockLocationCounters()]);
  return (
    <ModulePage>
      <PageHeader
        title="Emplacements de stock"
        description="Gerez vos entrepots, depots, magasins, sites et zones de stockage."
        actions={<Link href="/stock/emplacements/new"><Button><Plus className="h-4 w-4" /> Nouvel emplacement</Button></Link>}
      />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <StatCard title="Emplacements" value={counters.total} />
        <StatCard title="Actifs" value={counters.active} />
        <StatCard title="Par defaut" value={counters.defaultLocation?.name ?? "-"} />
      </div>
      <Card><CardContent><StockLocationsTable rows={rows} /></CardContent></Card>
    </ModulePage>
  );
}
