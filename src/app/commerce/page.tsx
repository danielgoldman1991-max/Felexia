import { CommerceDashboard } from "@/components/commerce/commerce-dashboard";
import { ModulePage } from "@/components/erp/module-page";
import { getCommerceCounters } from "@/lib/commerce";

export const dynamic = "force-dynamic";

export default async function CommercePage() {
  const counters = await getCommerceCounters();
  return (
    <ModulePage>
      <CommerceDashboard counters={counters} />
    </ModulePage>
  );
}
