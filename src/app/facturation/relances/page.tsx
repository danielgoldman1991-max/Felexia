import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { CustomerRemindersTable } from "@/components/reminders/customer-reminders-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listCustomerReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export default async function InvoiceRemindersPage() {
  const rows = await listCustomerReminders();
  return (
    <ModulePage>
      <PageHeader
        title="Relances"
        description="Suivi des factures echues et relances par niveau."
        actions={<Button asChild><Link href="/facturation/relances/new">Nouvelle relance</Link></Button>}
      />
      <Card><CardContent><CustomerRemindersTable rows={rows} /></CardContent></Card>
    </ModulePage>
  );
}
