import Link from "next/link";
import { CategoriesTable } from "@/components/articles/categories-table";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { listProductCategories } from "@/lib/products";

export default async function ProductCategoriesPage() {
  const categories = await listProductCategories();

  return (
    <ModulePage>
      <PageHeader
        title="Categories articles"
        description="Classement des articles et services par famille."
        actions={<Link href="/articles/categories/new"><Button>Nouvelle categorie</Button></Link>}
      />
      <CategoriesTable rows={categories} />
    </ModulePage>
  );
}
