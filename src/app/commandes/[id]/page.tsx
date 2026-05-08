import { notFound } from "next/navigation";
import { SalesOrderDetail } from "@/components/commerce/sales-order-detail";
import { ModulePage } from "@/components/erp/module-page";
import { getSalesOrderDetail } from "@/lib/commerce";

export default async function CommandeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { order, lines } = await getSalesOrderDetail(id);

  if (!order) {
    notFound();
  }

  return (
    <ModulePage>
      <SalesOrderDetail order={order} lines={lines} />
    </ModulePage>
  );
}
