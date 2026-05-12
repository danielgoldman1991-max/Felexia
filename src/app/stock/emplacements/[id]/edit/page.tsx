import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StockLocationForm } from "@/components/stock/stock-location-form";
import { updateStockLocation } from "@/lib/stock-location-actions";
import { getStockLocationDetail, listStockLocations } from "@/lib/stock-locations";

export const dynamic = "force-dynamic";

export default async function EditStockLocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ location }, locations] = await Promise.all([getStockLocationDetail(id), listStockLocations()]);
  if (!location) notFound();
  return (
    <ModulePage>
      <PageHeader title="Modifier emplacement" description={location.name} />
      <StockLocationForm location={location} locations={locations} action={updateStockLocation} />
    </ModulePage>
  );
}
