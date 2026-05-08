import { notFound } from "next/navigation";
import { SalesQuoteDetail } from "@/components/commerce/sales-quote-detail";
import { ModulePage } from "@/components/erp/module-page";
import { getSalesQuoteDetail } from "@/lib/commerce";

export default async function DevisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { quote, lines } = await getSalesQuoteDetail(id);

  if (!quote) {
    notFound();
  }

  return (
    <ModulePage>
      <SalesQuoteDetail quote={quote} lines={lines} />
    </ModulePage>
  );
}
