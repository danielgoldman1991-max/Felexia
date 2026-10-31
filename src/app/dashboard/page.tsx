import { FullDashboard } from "@/components/dashboard/full-dashboard";
import { LightDashboard } from "@/components/dashboard/light-dashboard";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export default async function DashboardPage({ searchParams }: {
  searchParams?: Promise<{ trial_started?: string | string[] }>;
}) {
  const workspace = await requireActiveWorkspace();
  if (await hasFullErpAccess(workspace.organization.id)) {
    return <FullDashboard searchParams={searchParams} />;
  }
  return <LightDashboard searchParams={searchParams} />;
}
