import { ModulePage } from "@/components/erp/module-page";
import { HrDashboard } from "@/components/hr/hr-dashboard";
import { getHrDashboardData } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrDashboardPage() {
  const data = await getHrDashboardData();
  return <ModulePage><HrDashboard data={data} /></ModulePage>;
}
