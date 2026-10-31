import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/articles/product-detail";
import { ModulePage } from "@/components/erp/module-page";
import { getProductByIdOrSku } from "@/lib/products";
import { requireActiveWorkspace } from "@/lib/auth";
import { hasFullErpAccess } from "@/lib/launch-access";

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const fullAccess = await hasFullErpAccess(workspace.organization.id);
  const { product } = await getProductByIdOrSku(id);

  if (!product) {
    notFound();
  }

  return (
    <ModulePage>
      <ProductDetail product={product} fullAccess={fullAccess} />
    </ModulePage>
  );
}
