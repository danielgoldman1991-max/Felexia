export type FifoReceipt = { quantity: number; unitCost: number; lot?: string | null; expiresOn?: string | null };

export type FifoResult = {
  quantity: number;
  value: number;
  layers: FifoReceipt[];
  negativeAttempt: boolean;
};

/** Premier entré, premier sorti. Une sortie au-delà du disponible est refusée. */
export function computeFifo(moves: { direction: "in" | "out"; quantity: number; unitCost?: number | null; lot?: string | null; expiresOn?: string | null }[]): FifoResult {
  const layers: FifoReceipt[] = [];
  let negativeAttempt = false;
  for (const move of moves) {
    const quantity = Number(move.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    if (move.direction === "in") {
      layers.push({ quantity, unitCost: Number(move.unitCost ?? 0), lot: move.lot, expiresOn: move.expiresOn });
      continue;
    }
    let remaining = quantity;
    while (remaining > 0.0005 && layers.length > 0) {
      const layer = layers[0];
      const taken = Math.min(layer.quantity, remaining);
      layer.quantity = Math.round((layer.quantity - taken) * 1000) / 1000;
      remaining = Math.round((remaining - taken) * 1000) / 1000;
      if (layer.quantity <= 0.0005) layers.shift();
    }
    if (remaining > 0.0005) negativeAttempt = true;
  }
  const quantity = Math.round(layers.reduce((sum, layer) => sum + layer.quantity, 0) * 1000) / 1000;
  const value = Math.round(layers.reduce((sum, layer) => sum + layer.quantity * layer.unitCost, 0) * 100) / 100;
  return { quantity, value, layers, negativeAttempt };
}

export function expiringLots(layers: FifoReceipt[], onDate: string) {
  return layers.filter((layer) => layer.expiresOn && layer.expiresOn <= onDate && layer.quantity > 0);
}
