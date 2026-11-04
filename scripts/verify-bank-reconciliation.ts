import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { planManualMatch } from "../src/lib/treasury/manual-match";
import { deductionPeriod, deductionTable, linkAllocationPayments, paymentModeLabel } from "../src/lib/tax/vat-deduction-report";
import { writeXlsx } from "../src/lib/spreadsheet/minimal-xlsx";
import { matchStatementLines, nameScore, reconciliationGap, scoreCandidate, splitBankCharge, DEFAULT_RECONCILIATION_SETTINGS, type MatchCandidate, type StatementLineInput } from "../src/lib/treasury/match-engine";
import { parseBankFile, parseMoroccanAmount, parseMoroccanDate, readXlsxGrid, statementLineHash } from "../src/lib/treasury/statement-parse";

assert.equal(parseMoroccanAmount("1 200,50"), 1200.5);
assert.equal(parseMoroccanAmount("1.234,56"), 1234.56);
assert.equal(parseMoroccanAmount("1\u202f200,00"), 1200);
assert.equal(parseMoroccanAmount("(17,50)"), -17.5);
assert.equal(parseMoroccanAmount("25,00-"), -25);
assert.equal(parseMoroccanDate("04/11/2026"), "2026-11-04");
assert.equal(parseMoroccanDate("04-11-2026"), "2026-11-04");
assert.equal(parseMoroccanDate("04.11.26"), "2026-11-04");
assert.equal(parseMoroccanDate("2026-11-04"), "2026-11-04");
assert.equal(nameScore("STE ATLAS NEGOCE", "Atlas Négoce"), 1);

const attijari = `Date opération;Date de valeur;Libellé;Débit;Crédit;Référence
04/11/2026;05/11/2026;VIR FAC-2611-00012 ATLAS NEGOCE;;1 200,00;VIR9981
04/11/2026;04/11/2026;CHQ 445566 STE ATLAS;;800,50;
03/11/2026;03/11/2026;COMMISSION VIREMENT;17,50;;
03/11/2026;03/11/2026;TVA SUR COMMISSION;1,75;;
02/11/2026;02/11/2026;AGIOS DECOUVERT;25,00;;
`;
const parsed = parseBankFile({ fileName: "awb.csv", text: attijari });
assert.equal(parsed.needsMapping, false);
assert.equal(parsed.rows.length, 5);
assert.equal(parsed.rows[0].direction, "in");
assert.equal(parsed.rows[0].amount, 1200);
assert.equal(parsed.rows[0].operation_date, "2026-11-04");
assert.equal(parsed.rows[2].direction, "out");
assert.equal(parsed.rows[2].amount, 17.5);
const account = "11111111-1111-1111-1111-111111111111";
assert.equal(statementLineHash(account, parsed.rows[0]), statementLineHash(account, parsed.rows[0]));
assert.notEqual(statementLineHash(account, parsed.rows[0]), statementLineHash(account, parsed.rows[1]));

const unknown = parseBankFile({ fileName: "banque.csv", text: "Colonne A;Colonne B\nfoo;bar\n" });
assert.equal(unknown.needsMapping, true);

const workbook = zip({
  "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet><sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Date</t></is></c><c r="B1" t="inlineStr"><is><t>Libellé</t></is></c><c r="C1" t="inlineStr"><is><t>Crédit</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>04/11/2026</t></is></c><c r="B2" t="inlineStr"><is><t>VIR FAC-2611-00012</t></is></c><c r="C2"><v>1200.50</v></c></row>
  </sheetData></worksheet>`,
});
assert.equal(readXlsxGrid(workbook).length, 2);
const excel = parseBankFile({ fileName: "cih.xlsx", text: "", bytes: workbook });
assert.equal(excel.rows[0].amount, 1200.5);
assert.equal(excel.rows[0].direction, "in");

const invoice: MatchCandidate = {
  id: "fac-12",
  kind: "customer_invoice",
  date: "2026-11-01",
  amount: 1200,
  direction: "in",
  number: "FAC-2611-00012",
  partyName: "Atlas Négoce",
  partyId: "atlas",
};
const line: StatementLineInput = {
  id: "l1",
  date: "2026-11-04",
  label: "VIR FAC-2611-00012 ATLAS NEGOCE",
  amount: 1200,
  direction: "in",
};
const [auto] = matchStatementLines({ lines: [line], candidates: [invoice] });
assert.equal(auto.band, "auto");
assert.equal(auto.createPayment, true);
assert.ok(auto.score >= 92);

const cheque = matchStatementLines({
  lines: [{ id: "l2", date: "2026-11-04", label: "CHQ 445566 STE ATLAS", amount: 800.5, direction: "in" }],
  candidates: [{ id: "tx1", kind: "transaction", date: "2026-11-04", amount: 800.5, direction: "in", reference: "445566", partyName: "Atlas Négoce", partyId: "atlas" }],
});
assert.equal(cheque[0].band, "auto");
assert.equal(cheque[0].targets[0].kind, "transaction");

const grouped = matchStatementLines({
  lines: [{ id: "l3", date: "2026-11-04", label: "VIR ATLAS NEGOCE", amount: 2000, direction: "in" }],
  candidates: [
    { ...invoice, id: "a", number: "FAC-2610-00001", amount: 1200, date: "2026-10-20" },
    { ...invoice, id: "b", number: "FAC-2610-00008", amount: 800, date: "2026-10-28" },
  ],
});
assert.equal(grouped[0].band, "suggestion");
assert.equal(grouped[0].targets.length, 2);

const namedGroup = matchStatementLines({
  lines: [{ id: "l4", date: "2026-11-04", label: "VIR FAC-2610-00001 ATLAS NEGOCE", amount: 2000, direction: "in" }],
  candidates: [
    { ...invoice, id: "a", number: "FAC-2610-00001", amount: 1200, date: "2026-10-20" },
    { ...invoice, id: "b", number: "FAC-2610-00008", amount: 800, date: "2026-10-28" },
  ],
});
assert.equal(namedGroup[0].band, "auto");

const partial = matchStatementLines({
  lines: [{ id: "l5", date: "2026-11-04", label: "VIR FAC-2611-00012", amount: 500, direction: "in" }],
  candidates: [{ ...invoice, amount: 1200 }],
});
assert.equal(partial[0].band, "suggestion");
assert.equal(partial[0].targets[0].amount, 500);

const fees = matchStatementLines({
  lines: [
    { id: "f1", date: "2026-11-03", label: "COMMISSION VIREMENT", amount: 17.5, direction: "out" },
    { id: "f2", date: "2026-11-03", label: "TVA SUR COMMISSION", amount: 1.75, direction: "out" },
    { id: "f3", date: "2026-11-02", label: "AGIOS DECOUVERT", amount: 25, direction: "out" },
  ],
  candidates: [],
});
assert.equal(fees[0].category, "commission");
assert.equal(fees[0].band, "suggestion");
assert.equal(fees[1].category, "vat_fee");
assert.equal(fees[2].category, "agio");

const ruled = matchStatementLines({
  lines: [{ id: "f4", date: "2026-11-03", label: "COMMISSION VIREMENT", amount: 17.5, direction: "out" }],
  candidates: [],
  rules: [{ id: "r1", labelContains: "commission", category: "commission", autoApply: true, active: true }],
});
assert.equal(ruled[0].band, "auto");

const weak = scoreCandidate(
  { id: "w", date: "2026-11-04", label: "VIR DIVERS", amount: 90, direction: "in" },
  { id: "c", kind: "customer_invoice", date: "2026-08-01", amount: 90, direction: "in", partyName: "Autre client", partyId: "x" },
  DEFAULT_RECONCILIATION_SETTINGS,
  [],
  null,
);
assert.ok(weak.score < 70);

const learned = scoreCandidate(line, invoice, DEFAULT_RECONCILIATION_SETTINGS, [{ labelKey: "atlas negoce", direction: "in", thirdPartyId: "atlas", confirmations: 2 }], null);
const plain = scoreCandidate(line, invoice, DEFAULT_RECONCILIATION_SETTINGS, [], null);
assert.ok(learned.score >= plain.score);

const split = splitBankCharge("COMMISSION TTC TVA", 110, "commission");
assert.equal(split.vat, 10);
assert.equal(split.net, 100);
assert.equal(split.expenseAccount, "6147");
assert.equal(splitBankCharge("AGIOS", 25, "agio").expenseAccount, "6311");
assert.equal(reconciliationGap(980, 1000.5), 20.5);
assert.equal(reconciliationGap(null, 10), null);

const prefersBook = matchStatementLines({
  lines: [line],
  candidates: [invoice, { id: "tx-existing", kind: "transaction", date: "2026-11-04", amount: 1200, direction: "in", partyId: "atlas", partyName: "Atlas Négoce" }],
});
assert.equal(prefersBook[0].targets[0].kind, "transaction");
assert.equal(prefersBook[0].createPayment, false);

const partialMatch = planManualMatch(
  [{ id: "l1", direction: "out", remaining: 1000, amount: 400 }],
  [{ id: "f1", kind: "supplier_invoice", direction: "out", remaining: 400, amount: 400 }],
);
assert.equal(partialMatch.ok && partialMatch.plan.kind, "partial");
assert.equal(partialMatch.ok && partialMatch.plan.partial, true);
const groupedMatch = planManualMatch(
  [
    { id: "l1", direction: "in", remaining: 700, amount: 700 },
    { id: "l2", direction: "in", remaining: 500, amount: 300 },
  ],
  [
    { id: "c1", kind: "customer_invoice", direction: "in", remaining: 800, amount: 800 },
    { id: "tx", kind: "transaction", direction: "in", remaining: 200, amount: 200 },
  ],
);
assert.equal(groupedMatch.ok && groupedMatch.plan.kind, "grouped");
assert.equal(groupedMatch.ok && groupedMatch.plan.total, 1000);
assert.equal(planManualMatch(
  [{ id: "l1", direction: "in", remaining: 100, amount: 100 }],
  [{ id: "f1", kind: "supplier_invoice", direction: "out", remaining: 100, amount: 100 }],
).ok, false);
assert.equal(planManualMatch(
  [{ id: "l1", direction: "in", remaining: 100, amount: 40 }],
  [{ id: "c1", kind: "customer_invoice", direction: "in", remaining: 100, amount: 50 }],
).ok, false);
assert.match(readFileSync("supabase/migrations/141_bank_manual_matches.sql", "utf8"), /undo_bank_manual_match/);
assert.match(readFileSync("supabase/rollbacks/141_bank_manual_matches_rollback.sql", "utf8"), /drop table if exists public.bank_manual_matches/);

assert.equal(deductionPeriod("2026-11-01", "2026-10-01").ok, false);
assert.equal(paymentModeLabel("bank_transfer"), "Virement");
const table = deductionTable([{
  supplier: "Atlas",
  ifNumber: "12345678",
  ice: "001234567890123",
  invoiceNumber: "FF-1",
  invoiceDate: "2026-11-04",
  amountHt: 1000,
  vatAmount: 200,
  payments: [{ date: "2026-11-10", mode: "cheque" }, { date: "2026-11-10", mode: "cheque" }],
}]);
assert.equal(table[1]?.[0], "Atlas");
assert.equal(table[1]?.[5], "1000,00");
assert.equal(table[1]?.[7], "2026-11-10");
assert.equal(table[1]?.[8], "Chèque");
const grid = readXlsxGrid(writeXlsx(table));
assert.equal(grid[0]?.[0], "Fournisseur");
assert.equal(grid[1]?.[3], "FF-1");
assert.equal(grid[1]?.[8], "Chèque");
const linked = linkAllocationPayments(
  [{ invoice_id: "inv-1", payment_id: "pay-1", amount: 120, allocation_date: "2026-11-02" }],
  [{ id: "pay-1", payment_date: "2026-11-03", payment_method: "virement", status: "confirmed", reference: "VIR1" }],
);
assert.equal(linked[0]?.payment?.date, "2026-11-03");
assert.equal(linked[0]?.payment?.mode, "virement");
assert.equal(linked[0]?.invoiceId, "inv-1");
for (const file of ["src/lib/tax/vat-deduction-query.ts", "src/lib/tax/dgi-vat-query.ts"]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /payment:payment_id/, `${file} ne doit pas embarquer payment_id`);
}
assert.match(readFileSync("src/lib/tax/vat-deduction-query.ts", "utf8"), /from\("supplier_payments"\)/);
assert.match(readFileSync("src/app/comptabilite/tva/deductions/page.tsx", "utf8"), /DEDUCTION_HEADERS/);

console.log("Rapprochement automatique : formats marocains, scores, groupes, frais et dédoublonnage vérifiés.");

function zip(files: Record<string, string>) {
  const parts: Buffer[] = [];
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const compressed = deflateRawSync(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(Buffer.byteLength(name), 26);
    parts.push(header, Buffer.from(name), compressed);
  }
  return Buffer.concat(parts);
}
