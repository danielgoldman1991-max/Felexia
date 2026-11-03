export type SupplierQuote = {
  id: string;
  supplier: string;
  totalHt: number;
  totalTtc: number;
  leadDays: number;
};

export type RankedQuote = SupplierQuote & {
  rank: number;
  recommended: boolean;
};

/** Le moins-disant TTC l'emporte. À prix égal, le délai le plus court est retenu. */
export function rankSupplierQuotes(quotes: SupplierQuote[]): RankedQuote[] {
  const ranked = [...quotes].sort((left, right) => {
    const price = left.totalTtc - right.totalTtc;
    if (Math.abs(price) > 0.009) return price;
    const delay = left.leadDays - right.leadDays;
    if (delay !== 0) return delay;
    return left.supplier.localeCompare(right.supplier, "fr");
  });
  return ranked.map((quote, index) => ({ ...quote, rank: index + 1, recommended: index === 0 && quotes.length > 0 }));
}
