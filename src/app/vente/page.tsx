import { SalesDashboard } from "@/components/sales/sales-dashboard";
import { ModulePage } from "@/components/erp/module-page";
import { getSalesCounters } from "@/lib/sales";

export const dynamic = "force-dynamic";

export default async function VentePage() {
  const counters = await getSalesCounters();

  return (
    <ModulePage>
      <SalesDashboard counters={counters} />
    </ModulePage>
  );
}
