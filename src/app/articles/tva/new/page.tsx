import { TaxRateForm } from "@/components/articles/tax-rate-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createTaxRate } from "@/lib/product-actions";

export default function NewVatPage() {
  return (
    <ModulePage>
      <PageHeader title="Nouveau taux TVA" description="Ajouter un taux de TVA applicable aux articles." />
      <TaxRateForm mode="create" action={createTaxRate} />
    </ModulePage>
  );
}
