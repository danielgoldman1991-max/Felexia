import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { HrEmployeeDetail } from "@/components/hr/hr-employee-detail";
import { getHrEmployeeDetail } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getHrEmployeeDetail(id);
  if (!detail) notFound();
  return <ModulePage><HrEmployeeDetail detail={detail} /></ModulePage>;
}
