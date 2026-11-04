import { isMissingSchema } from "@/lib/optional-schema";
import { applyCustomerTermsToLine, type CustomerPriceLine, type CustomerPriceTerms } from "@/lib/sales/price-lists";

type PriceListQuery = {
  eq: (column: string, value: unknown) => PriceListQuery;
  limit: (count: number) => PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { code?: string; message?: string } | null }>;
};

/** Prix et remise de la liste active du client. Sans migration 121, les lignes restent inchangées. */
export async function applyStoredCustomerPrices<T extends CustomerPriceLine>(
  supabase: { from: (table: string) => { select: (columns: string) => PriceListQuery } },
  organizationId: string,
  customerId: string,
  lines: T[],
): Promise<T[]> {
  const query = supabase
    .from("customer_price_lists")
    .select("id, discount_percent, active, customer_price_list_items(product_id, unit_price)")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("active", true)
    .limit(1);
  const { data, error } = await query;
  if (error || !data?.length) {
    if (isMissingSchema(error)) return lines;
    return lines;
  }
  const list = data[0];
  const rawItems = Array.isArray(list.customer_price_list_items) ? list.customer_price_list_items as Array<Record<string, unknown>> : [];
  const terms: CustomerPriceTerms = {
    discountPercent: Number(list.discount_percent ?? 0),
    items: rawItems.map((item) => ({ productId: (item.product_id as string | null) ?? null, unitPrice: Number(item.unit_price ?? 0) })),
  };
  return lines.map((line) => applyCustomerTermsToLine(line, terms));
}
