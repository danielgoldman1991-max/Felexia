import { notFound } from "next/navigation";
import { ProductForm } from "@/components/articles/product-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateProduct } from "@/lib/product-actions";
import { getProductByIdOrSku, listProductCategories, listTaxRates, listUnits } from "@/lib/products";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const { product } = await getProductByIdOrSku(id);

  if (!product) {
    notFound();
  }

  const [categories, units, taxRates] = await Promise.all([
    listProductCategories(),
    listUnits(),
    listTaxRates(),
  ]);

  return (
    <ModulePage>
      <PageHeader title="Modifier l'article" description="Nom, prix et TVA utilisés dans vos factures." />
      <ProductForm
        mode="edit"
        product={product}
        categories={categories}
        units={units}
        taxRates={taxRates}
        action={updateProduct}
        fullAccess={fullAccess}
      />
    </ModulePage>
  );
}
