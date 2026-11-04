export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type WeightedAccount = { accountId: string; weight: number };

/** Splits an amount across accounts in proportion to their weights. The last slice absorbs the rounding. */
export function allocateByWeight(total: number, parts: WeightedAccount[]): Array<{ accountId: string; amount: number }> {
  const positive = parts.filter((part) => part.weight > 0 && part.accountId);
  const sum = positive.reduce((acc, part) => acc + part.weight, 0);
  const target = roundMoney(total);
  if (sum <= 0 || target <= 0 || positive.length === 0) return [];
  let allocated = 0;
  return positive.map((part, index) => {
    const amount = index === positive.length - 1
      ? roundMoney(target - allocated)
      : roundMoney(target * part.weight / sum);
    allocated = roundMoney(allocated + amount);
    return { accountId: part.accountId, amount };
  }).filter((part) => part.amount > 0);
}

export type ProductAccountHint = {
  type?: string | null;
  sales_account_id?: string | null;
  purchase_account_id?: string | null;
} | null;

/** Merchandise uses the company setting. A service product uses the service account. A free line uses the service account. */
export function salesAccountId(product: ProductAccountHint, merchandiseId: string, serviceId: string) {
  if (product?.sales_account_id) return product.sales_account_id;
  if (!product || product.type === "service") return serviceId;
  return merchandiseId;
}

export function purchaseAccountId(product: ProductAccountHint, merchandiseId: string, serviceId: string) {
  if (product?.purchase_account_id) return product.purchase_account_id;
  if (!product || product.type === "service") return serviceId;
  return merchandiseId;
}
