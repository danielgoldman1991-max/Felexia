export type CustomerPriceLine = {
  product_id?: string | null;
  unit_price_ht: number;
  discount_rate: number;
};

export type CustomerPriceTerms = {
  discountPercent: number;
  items: Array<{ productId: string | null; unitPrice: number }>;
};

/** Applique le prix de liste du produit et, si la ligne n'a pas déjà une remise, la remise client. */
export function applyCustomerTermsToLine<T extends CustomerPriceLine>(line: T, terms: CustomerPriceTerms | null): T {
  if (!terms) return line;
  const item = terms.items.find((entry) => entry.productId && entry.productId === line.product_id);
  const unitPrice = item ? item.unitPrice : line.unit_price_ht;
  const discount = line.discount_rate > 0 ? line.discount_rate : terms.discountPercent;
  const priced = resolveCustomerPrice({ catalogPrice: line.unit_price_ht, listPrice: unitPrice, discountPercent: discount });
  return { ...line, unit_price_ht: item ? priced.base : line.unit_price_ht, discount_rate: discount };
}

/** Prix client : liste spécifique, sinon prix catalogue, puis remise en pourcentage. */
export function resolveCustomerPrice(input: { catalogPrice: number; listPrice?: number | null; discountPercent?: number | null }) {
  const base = input.listPrice != null && Number.isFinite(input.listPrice) ? input.listPrice : input.catalogPrice;
  const discount = Math.min(100, Math.max(0, input.discountPercent ?? 0));
  const net = Math.round(base * (1 - discount / 100) * 100) / 100;
  return { base: Math.round(base * 100) / 100, discount, net };
}
