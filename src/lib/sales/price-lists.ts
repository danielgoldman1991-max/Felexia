/** Prix client : liste spécifique, sinon prix catalogue, puis remise en pourcentage. */
export function resolveCustomerPrice(input: { catalogPrice: number; listPrice?: number | null; discountPercent?: number | null }) {
  const base = input.listPrice != null && Number.isFinite(input.listPrice) ? input.listPrice : input.catalogPrice;
  const discount = Math.min(100, Math.max(0, input.discountPercent ?? 0));
  const net = Math.round(base * (1 - discount / 100) * 100) / 100;
  return { base: Math.round(base * 100) / 100, discount, net };
}
