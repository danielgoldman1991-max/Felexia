import assert from "node:assert/strict";
import { canTransitionPayslip, payslipAmountsLocked, payslipStatusLabel } from "../src/lib/hr/payslip-lifecycle";
import { applyCustomerTermsToLine } from "../src/lib/sales/price-lists";
import { matchingReminderRule } from "../src/lib/sales/reminder-schedule";
import { inventoryAdjustments } from "../src/lib/stock/inventory";
import { duplicateThirdWarning } from "../src/lib/tiers/duplicate-third";

assert.equal(canTransitionPayslip("draft", "validated"), true);
assert.equal(canTransitionPayslip("calculated", "validated"), true);
assert.equal(canTransitionPayslip("validated", "paid"), true);
assert.equal(canTransitionPayslip("draft", "paid"), false);
assert.equal(canTransitionPayslip("paid", "validated"), false);
assert.equal(payslipAmountsLocked("validated"), true);
assert.equal(payslipAmountsLocked("calculated"), false);
assert.equal(payslipStatusLabel("paid"), "Payé");

const priced = applyCustomerTermsToLine(
  { product_id: "p1", unit_price_ht: 100, discount_rate: 0 },
  { discountPercent: 10, items: [{ productId: "p1", unitPrice: 80 }] },
);
assert.equal(priced.unit_price_ht, 80);
assert.equal(priced.discount_rate, 10);
const kept = applyCustomerTermsToLine(
  { product_id: "p1", unit_price_ht: 100, discount_rate: 5 },
  { discountPercent: 10, items: [] },
);
assert.equal(kept.discount_rate, 5);

const rule = matchingReminderRule([
  { id: "a", daysAfterDue: 7, level: 1, active: true, message: "Amiable" },
  { id: "b", daysAfterDue: 30, level: 3, active: true, message: "Ferme" },
  { id: "c", daysAfterDue: 15, level: 2, active: false, message: "Off" },
], 20);
assert.equal(rule?.id, "a");

const moves = inventoryAdjustments([
  { productId: "a", theoretical: 10, counted: 8 },
  { productId: "b", theoretical: 4, counted: 4 },
  { productId: "c", theoretical: 1, counted: 3 },
]);
assert.deepEqual(moves, [
  { productId: "a", direction: "out", quantity: 2 },
  { productId: "c", direction: "in", quantity: 2 },
]);

const people = [{ id: "1", name: "Atlas Client", ice: "001234567000084" }];
assert.match(duplicateThirdWarning(people, { name: "Autre", ice: "001234567000084" }) ?? "", /même ICE/);
assert.match(duplicateThirdWarning(people, { name: "atlas client", ice: null }) ?? "", /même nom/);
assert.equal(duplicateThirdWarning(people, { name: "Atlas Client", ice: "001234567000084" }, "1"), null);

console.log("Complétion : cycle de paie, prix client, règle de relance, inventaire et doublon de tiers vérifiés.");
