import Link from "next/link";
import { DocumentTable } from "@/components/erp/data-tables";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { invoices } from "@/lib/demo-data";

export default function FacturesPage() {
  return (
    <ModulePage>
      <PageHeader
        title="Factures clients"
        description="Factures, paiements, echeances et suivi des impayes."
        actions={<Button asChild><Link href="/factures/new">Nouvelle facture</Link></Button>}
      />
      <DocumentTable rows={invoices} basePath="/factures" />
    </ModulePage>
  );
}
