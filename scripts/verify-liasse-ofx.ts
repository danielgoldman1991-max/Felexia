import assert from "node:assert/strict";
import { buildLiasse, buildLiasseExcel } from "../src/lib/accounting/liasse";
import { parseOfx } from "../src/lib/treasury/ofx";

const liasse = buildLiasse([
  { accountCode: "2111", debit: 1000, credit: 0 },
  { accountCode: "1111", debit: 0, credit: 1000 },
  { accountCode: "34551", debit: 200, credit: 0 },
  { accountCode: "4411", debit: 0, credit: 200 },
], 500);
assert.equal(liasse.bilan.balanced, true);
assert.ok(liasse.postes.some((poste) => poste.code === "21" && poste.section === "actif"));
assert.ok(liasse.postes.some((poste) => poste.code === "34551" && poste.section === "annexe"));
assert.ok(liasse.postes.some((poste) => poste.code === "ESG-F" && poste.amount === 500));
const excel = buildLiasseExcel(liasse);
assert.match(excel, /Immobilisations en non-valeurs/);
assert.match(excel, /1000.00/);

const ofx = parseOfx(`
<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261104120000
<TRNAMT>-120.50
<FITID>A1
<NAME>VIR FOURNISSEUR
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261105
<TRNAMT>80,00
<FITID>A2
<MEMO>Encaissement
</STMTTRN>
</OFX>`);
assert.equal(ofx.length, 2);
assert.equal(ofx[0].date, "2026-11-04");
assert.equal(ofx[0].debit, "120.50");
assert.equal(ofx[0].credit, "0");
assert.equal(ofx[1].credit, "80.00");
assert.equal(ofx[1].label, "Encaissement");

console.log("Liasse détaillée et import OFX vérifiés.");
