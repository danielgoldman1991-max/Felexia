import { notFound } from "next/navigation";
import { SalesQuoteForm } from "@/components/commerce/sales-quote-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateSalesQuote } from "@/lib/commerce-actions";
import { getSalesQuoteDetail, listCustomersForSelect, listProductsForSelect, listTaxRatesForSelect } from "@/lib/commerce";
import { listUnits } from "@/lib/products";

export default async function EditDevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ quote, lines }, customers, products, taxRates, units] = await Promise.all([
    getSalesQuoteDetail(id),
    listCustomersForSelect(),
    listProductsForSelect(),
    listTaxRatesForSelect(),
    listUnits(),
  ]);

  const defaultTaxRate = taxRates.find((t) => t.is_default) ?? taxRates.reduce((a, b) => (a.rate > b.rate ? a : b), taxRates[0]);

  if (!quote) {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader title="Modifier le devis" description={quote.number ?? "Devis"} />
      <SalesQuoteForm
        mode="edit"
        quote={quote}
        lines={lines}
        customers={customers}
        products={products}
        taxRates={taxRates}
        units={units}
        defaultTaxRate={defaultTaxRate ? { id: defaultTaxRate.id, rate: defaultTaxRate.rate } : null}
        action={updateSalesQuote}
      />
    </ModulePage>
  );
}
