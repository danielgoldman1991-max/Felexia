import Link from "next/link";
import { QuotesTable } from "@/components/commerce/quotes-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listSalesQuotes } from "@/lib/commerce";

export default async function DevisPage() {
  const { rows } = await listSalesQuotes({});

  return (
    <ModulePage>
      <PageHeader
        title="Devis"
        description="Cycle de vente avant commande et facturation."
        actions={<Button asChild><Link href="/devis/new">Nouveau devis</Link></Button>}
      />
      <QuotesTable rows={rows} />
    </ModulePage>
  );
}
