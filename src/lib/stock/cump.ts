export type CumpMovement = {
  direction: "in" | "out";
  quantity: number;
  /** Coût unitaire des entrées. Les sorties consomment le CMUP courant. */
  unitCost?: number | null;
};

export type CumpResult = {
  quantity: number;
  averageCost: number;
  value: number;
  negativeAttempt: boolean;
};

export function weightedAverageCost(onHandQty: number, oldCost: number, receivedQty: number, receivedCost: number) {
  const held = Number.isFinite(onHandQty) ? Math.max(0, onHandQty) : 0;
  const incoming = Number.isFinite(receivedQty) ? receivedQty : 0;
  const total = held + incoming;
  if (total <= 0) return 0;
  const value = held * (Number.isFinite(oldCost) ? oldCost : 0) + incoming * (Number.isFinite(receivedCost) ? receivedCost : 0);
  return Math.round((value / total) * 100) / 100;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * Coût moyen unitaire pondéré. Les lots et numéros de série ne sont pas suivis :
 * une entrée sans coût reprend le CMUP déjà constitué, jamais un prix inventé.
 * Une sortie au-delà du stock disponible est refusée dans le résultat (quantité
 * non consommée, negativeAttempt).
 */
export function computeCump(moves: CumpMovement[]): CumpResult {
  let quantity = 0;
  let value = 0;
  let negativeAttempt = false;
  for (const move of moves) {
    const qty = Number(move.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (move.direction === "in") {
      const average = quantity > 0 ? value / quantity : 0;
      const unit = move.unitCost == null || !Number.isFinite(Number(move.unitCost)) ? average : Number(move.unitCost);
      value += qty * unit;
      quantity += qty;
    } else if (qty > quantity + 0.0005) {
      negativeAttempt = true;
      value = 0;
      quantity = 0;
    } else {
      const average = quantity > 0 ? value / quantity : 0;
      value -= qty * average;
      quantity -= qty;
    }
  }
  const safeQuantity = round3(Math.max(0, quantity));
  const safeValue = round2(Math.max(0, value));
  return {
    quantity: safeQuantity,
    averageCost: safeQuantity > 0 ? round2(safeValue / safeQuantity) : 0,
    value: safeValue,
    negativeAttempt,
  };
}
