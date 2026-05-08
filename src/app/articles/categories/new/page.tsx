import { CategoryForm } from "@/components/articles/category-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createProductCategory } from "@/lib/product-actions";

export default function NewCategoryPage() {
  return (
    <ModulePage>
      <PageHeader title="Nouvelle categorie" description="Ajouter une famille d'articles ou services." />
      <CategoryForm mode="create" action={createProductCategory} />
    </ModulePage>
  );
}
