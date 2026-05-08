import { notFound } from "next/navigation";
import { ProductForm } from "@/components/articles/product-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateProduct } from "@/lib/product-actions";
import { getProductByIdOrSku, listProductCategories, listTaxRates, listUnits } from "@/lib/products";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      <PageHeader title="Modifier l'article" description="Produit stocke ou service facture." />
      <ProductForm
        mode="edit"
        product={product}
        categories={categories}
        units={units}
        taxRates={taxRates}
        action={updateProduct}
      />
    </ModulePage>
  );
}
