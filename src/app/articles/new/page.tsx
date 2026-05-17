import { ProductForm } from "@/components/articles/product-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createProduct } from "@/lib/product-actions";
import { listProductCategories, listTaxRates, listUnits } from "@/lib/products";
import { ensureProductCategories, ensureUnits } from "@/lib/actions/ensure-reference-data";

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType = rawType === "product" || rawType === "service" ? rawType : undefined;

  await Promise.all([ensureProductCategories(), ensureUnits()]);
  const [categories, units, taxRates] = await Promise.all([
    listProductCategories(),
    listUnits(),
    listTaxRates(),
  ]);

  return (
    <ModulePage>
      <PageHeader title="Nouvel article" description="Produit stocke ou service facture." />
      <ProductForm
        mode="create"
        categories={categories}
        units={units}
        taxRates={taxRates}
        action={createProduct}
        initialType={initialType}
      />
    </ModulePage>
  );
}
