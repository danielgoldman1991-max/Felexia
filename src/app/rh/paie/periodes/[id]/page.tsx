import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";
import { calculateHrPayrollPeriodAction } from "@/lib/hr/actions";

export default async function PayrollPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const action = calculateHrPayrollPeriodAction.bind(null, id);
  return (
    <ModulePage>
      <PageHeader title="Période de paie" description="Calcul préparatoire des bulletins à partir des employés actifs et paramètres RH." actions={<form action={action}><Button type="submit">Calculer les bulletins</Button></form>} />
      <HrPreparatoryNotice />
    </ModulePage>
  );
}
