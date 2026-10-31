import Link from "next/link";
import { Plus } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { CustomerPaymentsTable } from "@/components/payments/customer-payments-table";
import { listCustomerPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function CustomerPaymentsPage() {
  const { rows } = await listCustomerPayments();
  return (
    <ModulePage>
      <PageHeader
        title="Règlements reçus"
        description="Suivez les encaissements de vos clients et leur affectation aux factures."
        actions={<Button asChild><Link href="/facturation/paiements/new"><Plus className="h-4 w-4" aria-hidden="true" />Nouveau règlement</Link></Button>}
      />
      <CustomerPaymentsTable rows={rows} />
    </ModulePage>
  );
}
