/** Prorata de déduction : TVA taxable / (taxable + exonéré). Le dénominateur nul donne 0. */
export function vatProrata(taxableTurnover: number, exemptTurnover: number): number {
  const taxable = Math.max(0, taxableTurnover);
  const exempt = Math.max(0, exemptTurnover);
  const base = taxable + exempt;
  if (base <= 0) return 0;
  return Math.round((taxable / base) * 10000) / 10000;
}

export function deductibleVat(vatOnPurchases: number, prorata: number): number {
  return Math.round(Math.max(0, vatOnPurchases) * Math.min(1, Math.max(0, prorata)) * 100) / 100;
}
