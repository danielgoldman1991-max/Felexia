import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { currentNumberingPeriod, isNumberingCounterAllowed, isNumberingMigrationMissing, MAX_NUMBERING_VALUE, numberingErrorMessage, parseNumberingPeriod, toNumberingCounter } from "../src/lib/numbering-model";

for (const period of ["2026-10", "1900-01", "2199-12"]) assert.equal(parseNumberingPeriod(period), period);
for (const period of ["2026-00", "2026-13", "2026-1", "2026-10-31", "2026-10x", "2200-01", " 2026-10", null]) assert.equal(parseNumberingPeriod(period), null);
assert.equal(currentNumberingPeriod(new Date("2026-10-31T23:30:00Z")), "2026-11");
assert.equal(isNumberingCounterAllowed("customer_invoice", false), true);
assert.equal(isNumberingCounterAllowed("supplier_payment", false), true);
assert.equal(isNumberingCounterAllowed("sales_quote", false), false);
assert.equal(isNumberingCounterAllowed("sales_quote", true), true);
assert.equal(isNumberingCounterAllowed("journal:30000000-0000-4000-8000-000000000001", false), true);
assert.equal(isNumberingCounterAllowed("journal:../../organizations", true), false);
assert.equal(isNumberingCounterAllowed("unknown_type", true), false);
const row = {
  counter_key: "customer_invoice", label: "Factures clients", group_key: "sales", prefix: "FAC-2610-",
  period_label: "2026-10", reset_period: "monthly", padding: 5, next_number: 100000,
  minimum_next_number: 13, max_used_number: 12, next_document_number: "FAC-2610-100000",
  last_document_number: "FAC-2610-00012", revision: "a".repeat(32),
};
const counter = toNumberingCounter(row);
assert.equal(counter.nextExample, "FAC-2610-100000");
assert.equal(counter.numberPattern.replace("{NUMBER}", String(100001).padStart(counter.numberWidth, "0")), "FAC-2610-100001");
assert.equal(counter.minNextNumber, 13);
assert.equal(counter.editable, true);
for (const invalid of [{ ...row, next_number: -1 }, { ...row, next_number: "12e2" }, { ...row, padding: 500 }, { ...row, revision: "bad" }, { ...row, counter_key: "unknown" }]) assert.throws(() => toNumberingCounter(invalid));
const exhausted = toNumberingCounter({ ...row, minimum_next_number: MAX_NUMBERING_VALUE + 1, next_number: MAX_NUMBERING_VALUE + 1 });
assert.equal(exhausted.editable, false);
assert.equal(toNumberingCounter({ ...row, minimum_next_number: 2_147_483_648, next_number: 2_147_483_648, is_exhausted: true }).editable, false);
const inflated = toNumberingCounter({ ...row, next_number: 2_147_483_647, minimum_next_number: 13, is_exhausted: false });
assert.equal(inflated.editable, true, "An inflated unused counter can be repaired above its real used-number floor");
assert.ok(inflated.issue);
assert.equal(isNumberingMigrationMissing({ code: "PGRST202" }), true);
assert.equal(isNumberingMigrationMissing({ code: "42501" }), false);
assert.match(numberingErrorMessage({ message: "NUMBERING_REVISION_CONFLICT" }), /Actualisez/);
assert.match(numberingErrorMessage({ message: "NUMBERING_BELOW_MINIMUM" }), /déjà attribué/);
assert.match(numberingErrorMessage({ code: "42501" }), /administrateur/);
assert.doesNotMatch(numberingErrorMessage({ message: "arbitrary SQL internals" }), /SQL/);
const nativeContract = JSON.parse(readFileSync(new URL("../training/numbering-counters/20261031/counter-contract.json", import.meta.url), "utf8"));
assert.equal(nativeContract.syntheticOnly, true);
const nativeCounters = nativeContract.counters.map(toNumberingCounter);
assert.equal(nativeCounters.length, 17, "All PostgreSQL catalog rows must satisfy the real UI contract");
assert.equal(new Set(nativeCounters.map((item: { key: string }) => item.key)).size, 17);
assert.equal(nativeCounters.filter((item: { key: string }) => isNumberingCounterAllowed(item.key, false)).length, 9);
console.log("Numérotation : périodes, profils, aperçu à six chiffres, bornes et erreurs vérifiés.");
