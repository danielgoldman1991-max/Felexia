import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/articles/category-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateProductCategory } from "@/lib/product-actions";
import { listProductCategories } from "@/lib/products";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categories = await listProductCategories();
  const category = categories.find((c) => c.id === id);

  if (!category) {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader title="Modifier la categorie" description={category.name} />
      <CategoryForm mode="edit" category={category} action={updateProductCategory} />
    </ModulePage>
  );
}
