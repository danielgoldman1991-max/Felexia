import { FullDashboard } from "@/components/dashboard/full-dashboard";
import { LightDashboard } from "@/components/dashboard/light-dashboard";
import { requireActiveWorkspace } from "@/lib/auth";
import { moduleAccessError } from "@/lib/auth/module-permission";
import { hasFullErpAccess } from "@/lib/launch-access";

export default async function DashboardPage({ searchParams }: {
  searchParams?: Promise<{ trial_started?: string | string[]; setup_notice?: string | string[] }>;
}) {
  const workspace = await requireActiveWorkspace();
  const denied = await moduleAccessError(workspace, "dashboard", "read");
  if (denied) return <p className="p-8 text-sm">{denied}</p>;
  if (await hasFullErpAccess(workspace.organization.id)) {
    return <FullDashboard searchParams={searchParams} />;
  }
  return <LightDashboard searchParams={searchParams} />;
}
