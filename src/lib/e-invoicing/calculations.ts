import { decimalScaled, decimalText, divideRounded } from "./decimal";
import type { EInvoiceLineInput } from "./types";

export function calculateExactLine(line: EInvoiceLineInput) {
  const quantity = decimalScaled(line.quantity, 3);
  const price = decimalScaled(line.unitPriceHt, 2);
  const discount = decimalScaled(line.discountRate, 2);
  const rate = decimalScaled(line.taxRate, 2);
  if (quantity <= BigInt("0") || price < BigInt("0") || discount < BigInt("0") || discount > BigInt("10000") || rate < BigInt("0") || rate > BigInt("10000")) throw new Error("DECIMAL_INVALID_LINE");
  if ([quantity, price].some(value => value > BigInt("99999999999999"))) throw new Error("DECIMAL_DATABASE_RANGE_EXCEEDED");
  const gross = divideRounded(quantity * price, BigInt("1000"));
  const allowance = divideRounded(gross * discount, BigInt("10000"));
  const net = gross - allowance;
  const tax = divideRounded(net * rate, BigInt("10000"));
  if (net + tax > BigInt("99999999999999")) throw new Error("DECIMAL_DATABASE_RANGE_EXCEEDED");
  return {
    quantity: decimalText(quantity, 3), unitPriceHt: decimalText(price, 2), discountRate: decimalText(discount, 2), taxRate: decimalText(rate, 2),
    grossHt: decimalText(gross, 2), discountAmount: decimalText(allowance, 2), subtotalHt: decimalText(net, 2), taxAmount: decimalText(tax, 2), totalTtc: decimalText(net + tax, 2),
  };
}
