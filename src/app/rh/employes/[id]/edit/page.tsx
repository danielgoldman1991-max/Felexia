import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrEmployeeForm } from "@/components/hr/hr-employee-form";
import { getHrEmployeeDetail, getHrReferenceData } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function EditHrEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, refs] = await Promise.all([getHrEmployeeDetail(id), getHrReferenceData()]);
  if (!detail) notFound();
  return (
    <ModulePage>
      <PageHeader title="Modifier employé" description="Mettez à jour la fiche salarié sans perdre l'historique RH." />
      <HrEmployeeForm departments={refs.departments} positions={refs.positions} employee={detail.employee} />
    </ModulePage>
  );
}
