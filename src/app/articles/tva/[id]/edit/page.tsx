import { notFound } from "next/navigation";
import { TaxRateForm } from "@/components/articles/tax-rate-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateTaxRate } from "@/lib/product-actions";
import { listTaxRates } from "@/lib/products";

export default async function EditVatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taxRates = await listTaxRates();
  const taxRate = taxRates.find((t) => t.id === id);

  if (!taxRate) {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader title="Modifier le taux TVA" description={taxRate.name} />
      <TaxRateForm mode="edit" taxRate={taxRate} action={updateTaxRate} />
    </ModulePage>
  );
}
