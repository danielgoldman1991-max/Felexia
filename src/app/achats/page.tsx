import { PurchaseDashboard } from "@/components/purchases/purchase-dashboard";
import { ModulePage } from "@/components/erp/module-page";
import { getPurchaseCountersForDisplay } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function AchatsPage() {
  const counters = await getPurchaseCountersForDisplay();
  return <ModulePage><PurchaseDashboard counters={counters} /></ModulePage>;
}
