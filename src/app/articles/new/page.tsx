import { ProductForm } from "@/components/articles/product-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createProduct } from "@/lib/product-actions";
import { listProductCategories, listTaxRates, listUnits } from "@/lib/products";
import { ensureProductCategories, ensureUnits } from "@/lib/actions/ensure-reference-data";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
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
      <PageHeader title="Nouvel article ou service" description="Retrouvez son nom, ses prix et sa TVA dans vos prochaines factures." />
      <ProductForm
        mode="create"
        categories={categories}
        units={units}
        taxRates={taxRates}
        action={createProduct}
        initialType={initialType}
        fullAccess={fullAccess}
      />
    </ModulePage>
  );
}
