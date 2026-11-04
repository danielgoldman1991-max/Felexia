export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** TTC et taux de TVA vers HT et TVA. Le TTC reste la saisie. */
export function amountsFromTtc(ttc: number, ratePercent: number) {
  const gross = roundMoney(Math.max(0, ttc));
  const rate = Math.max(0, ratePercent) / 100;
  const ht = rate === 0 ? gross : roundMoney(gross / (1 + rate));
  const tax = roundMoney(gross - ht);
  return { amountHt: ht, taxAmount: tax, amountTtc: gross, taxRate: roundMoney(ratePercent) };
}
