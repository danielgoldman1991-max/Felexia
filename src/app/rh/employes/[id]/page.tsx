import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { HrEmployeeDetail } from "@/components/hr/hr-employee-detail";
import { requireHrWorkspace } from "@/lib/hr/access";
import { getHrEmployeeDetail } from "@/lib/hr/hr";
import { canWriteHrSettings } from "@/lib/hr/settings-access";

export const dynamic = "force-dynamic";

export default async function HrEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, workspace] = await Promise.all([getHrEmployeeDetail(id), requireHrWorkspace()]);
  if (!detail) notFound();
  const canWrite = await canWriteHrSettings(workspace);
  return <ModulePage><HrEmployeeDetail detail={detail} canWrite={canWrite} /></ModulePage>;
}
