import { ModulePage } from "@/components/erp/module-page";
import { HrEmployeesPage } from "@/components/hr/hr-employees-page";
import { listHrEmployees } from "@/lib/hr/hr";

export const dynamic = "force-dynamic";

export default async function HrEmployesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const employees = await listHrEmployees(params?.q);
  return <ModulePage><HrEmployeesPage employees={employees} /></ModulePage>;
}
