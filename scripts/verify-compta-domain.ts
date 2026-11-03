import assert from "node:assert/strict";
import { periodsToLock, assertPeriodOpen } from "../src/lib/accounting/fiscal-close";
import { deductibleVat, vatProrata } from "../src/lib/accounting/vat-prorata";
import { buildEdiSimpl } from "../src/lib/accounting/edi-simpl";
import { buildLiasse } from "../src/lib/accounting/liasse";
import { buildFec } from "../src/lib/accounting/fec";

assert.deepEqual(periodsToLock([
  { id: "a", start: "2026-01-01", end: "2026-01-31", locked: false },
  { id: "b", start: "2026-02-01", end: "2026-02-28", locked: true },
], "2026-01-31").map((period) => period.id), ["a"]);
assert.throws(() => assertPeriodOpen({ locked: true }, "janvier"), /clôturée/);

assert.equal(vatProrata(80, 20), 0.8);
assert.equal(deductibleVat(1000, 0.8), 800);
assert.equal(vatProrata(0, 0), 0);

const simpl = buildEdiSimpl("001234567000012", "202611", [{ code: "140", base: 1000, tax: 200 }]);
assert.match(simpl, /SIMPL;PREPARATOIRE/);
assert.match(simpl, /140;1000.00;200.00/);

const liasse = buildLiasse([
  { accountCode: "2111", debit: 1000, credit: 0 },
  { accountCode: "1111", debit: 0, credit: 1000 },
], 1000);
assert.equal(liasse.bilan.balanced, true);
assert.equal(liasse.esg.capitauxFin, 1000);

const fec = buildFec([{ journalCode: "VE", journalLabel: "Ventes", entryNumber: "1", entryDate: "2026-11-03", account: "3421", accountLabel: "Clients", piece: "FAC-1", pieceDate: "2026-11-03", label: "Facture", debit: 120, credit: 0 }]);
assert.match(fec, /JournalCode\tJournalLib/);
assert.match(fec, /20261103/);
console.log("Comptabilité : clôture, prorata, SIMPL, liasse et FEC préparatoires vérifiés.");
