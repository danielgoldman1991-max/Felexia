import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StockLocationForm } from "@/components/stock/stock-location-form";
import { createStockLocation } from "@/lib/stock-location-actions";
import { listStockLocations } from "@/lib/stock-locations";

export const dynamic = "force-dynamic";

export default async function NewStockLocationPage() {
  const locations = await listStockLocations();
  return (
    <ModulePage>
      <PageHeader title="Nouvel emplacement de stock" description="Creez un entrepot, depot, magasin, site ou zone de stockage." />
      <StockLocationForm locations={locations} action={createStockLocation} />
    </ModulePage>
  );
}
