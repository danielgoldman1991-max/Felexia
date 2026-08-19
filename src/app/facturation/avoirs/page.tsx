import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerCreditNotesTable } from "@/components/credit-notes/customer-credit-notes-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listCustomerCreditNotes } from "@/lib/credit-notes";

export const dynamic = "force-dynamic";

export default async function CustomerCreditNotesPage() {
  const rows = await listCustomerCreditNotes();
  return (
    <ModulePage>
      <PageHeader
        title="Avoirs clients"
        description="Avoirs libres, corrections facture et credits disponibles."
        actions={<Button asChild><Link href="/facturation/avoirs/new">Nouvel avoir</Link></Button>}
      />
      <Card><CardContent><CustomerCreditNotesTable rows={rows} /></CardContent></Card>
    </ModulePage>
  );
}
