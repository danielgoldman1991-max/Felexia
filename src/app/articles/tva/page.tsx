import Link from "next/link";
import { TaxRatesTable } from "@/components/articles/tax-rates-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listTaxRates } from "@/lib/products";

export default async function VatPage() {
  const taxRates = await listTaxRates();

  return (
    <ModulePage>
      <PageHeader
        title="TVA articles"
        description="Parametrage des taux de TVA applicables aux articles et services."
        actions={<Link href="/articles/tva/new"><Button>Nouveau taux TVA</Button></Link>}
      />
      <TaxRatesTable rows={taxRates} />
    </ModulePage>
  );
}
