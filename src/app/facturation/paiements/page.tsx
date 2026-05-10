import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerPaymentsTable } from "@/components/payments/customer-payments-table";
import { listCustomerPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function CustomerPaymentsPage() {
  const { rows } = await listCustomerPayments();
  return (
    <ModulePage>
      <PageHeader
        title="Paiements clients"
        description="Reglements, avances et soldes disponibles a affecter."
        actions={<Link href="/facturation/paiements/new"><Button>Nouveau paiement</Button></Link>}
      />
      <Card><CardContent><CustomerPaymentsTable rows={rows} /></CardContent></Card>
    </ModulePage>
  );
}
