export function inventoryVariance(counted: number, theoretical: number) {
  const variance = Math.round((counted - theoretical) * 1000) / 1000;
  return { counted, theoretical, variance, matched: Math.abs(variance) < 0.001 };
}

export function reorderSuggestion(onHand: number, minimum: number, incoming = 0) {
  const shortage = Math.round((minimum - onHand - incoming) * 1000) / 1000;
  return { needed: shortage > 0, quantity: Math.max(0, shortage) };
}
