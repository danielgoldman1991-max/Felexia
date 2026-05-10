import { PurchaseDashboard } from "@/components/purchases/purchase-dashboard";
import { ModulePage } from "@/components/erp/module-page";
import { getPurchaseCounters } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export default async function AchatsPage() {
  const counters = await getPurchaseCounters();
  return <ModulePage><PurchaseDashboard counters={counters} /></ModulePage>;
}
