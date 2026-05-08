import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/articles/product-detail";
import { ModulePage } from "@/components/erp/module-page";
import { getProductByIdOrSku } from "@/lib/products";

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { product } = await getProductByIdOrSku(id);

  if (!product) {
    notFound();
  }

  return (
    <ModulePage>
      <ProductDetail product={product} />
    </ModulePage>
  );
}
