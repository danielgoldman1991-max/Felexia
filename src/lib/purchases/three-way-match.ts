export type ThreeWayLine = {
  description: string;
  ordered: number;
  received: number;
  invoiced: number;
};

export function matchPurchaseLine(line: ThreeWayLine) {
  const gapReceipt = Math.round((line.ordered - line.received) * 1000) / 1000;
  const gapInvoice = Math.round((line.received - line.invoiced) * 1000) / 1000;
  const matched = Math.abs(gapReceipt) < 0.001 && Math.abs(gapInvoice) < 0.001;
  return { ...line, gapReceipt, gapInvoice, matched };
}

export function matchPurchase(lines: ThreeWayLine[]) {
  const details = lines.map(matchPurchaseLine);
  return { details, matched: details.every((line) => line.matched) };
}
