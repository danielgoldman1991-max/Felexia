import assert from "node:assert/strict";
import { computeFifo, expiringLots } from "../src/lib/stock/fifo";
import { inventoryVariance, reorderSuggestion } from "../src/lib/stock/inventory";
import { computeCump } from "../src/lib/stock/cump";

const fifo = computeFifo([
  { direction: "in", quantity: 10, unitCost: 5, lot: "A", expiresOn: "2026-12-01" },
  { direction: "in", quantity: 4, unitCost: 8, lot: "B", expiresOn: "2026-11-01" },
  { direction: "out", quantity: 12 },
]);
assert.equal(fifo.negativeAttempt, false);
assert.equal(fifo.quantity, 2);
assert.equal(fifo.value, 16);
assert.equal(fifo.layers[0]?.lot, "B");
assert.equal(expiringLots(fifo.layers, "2026-11-03").length, 1);

const cump = computeCump([{ direction: "in", quantity: 10, unitCost: 5 }, { direction: "in", quantity: 10, unitCost: 7 }, { direction: "out", quantity: 5 }]);
assert.equal(cump.quantity, 15);
assert.equal(inventoryVariance(9, 10).variance, -1);
assert.deepEqual(reorderSuggestion(2, 10, 3), { needed: true, quantity: 5 });
assert.equal(reorderSuggestion(8, 5).needed, false);
console.log("Stock : FIFO, péremption, écart d'inventaire et réapprovisionnement vérifiés. Le CMUP reste le coût par défaut.");
