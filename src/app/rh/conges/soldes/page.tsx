import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { refreshLeaveBalancesAction } from "@/lib/hr/actions";
import { LeaveBalanceForm } from "./form";

export default function LeaveBalancesPage() {
  return (
    <ModulePage>
      <PageHeader title="Soldes de congés" description="1,5 jour ouvrable par mois de service, soit 18 jours par année complète." />
      <LeaveBalanceForm action={refreshLeaveBalancesAction} />
    </ModulePage>
  );
}
