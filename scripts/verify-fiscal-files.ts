import assert from "node:assert/strict";
import { fecAuxiliaryColumns, partyAuxiliaryCode } from "../src/lib/accounting/fec-parties";
import { frenchStatusLabel } from "../src/components/erp/status-badge";
import { buildEdiSimpl } from "../src/lib/accounting/edi-simpl";
import { bdsIssues, buildIsFile, controlTrailer, declarationToSimplLines, irIssues, validateSimpl } from "../src/lib/accounting/fiscal-files";

const lines = declarationToSimplLines([
  { code: "080", amountMad: 1000 },
  { code: "080T", amountMad: 200 },
  { code: "130", amountMad: 200 },
]);
assert.deepEqual(lines[0], { code: "080", base: 1000, tax: 200 });
const simpl = buildEdiSimpl("001234567000012", "202611", lines);
assert.match(simpl, /SIMPL;PREPARATOIRE/);
assert.match(simpl, /080;1000.00;200.00/);
assert.deepEqual(validateSimpl("001234567000012", "202611", lines), []);
assert.ok(validateSimpl("123", "2026", lines).length >= 2);
assert.ok(validateSimpl("001234567000012", "202611", [{ code: "080", base: 1000, tax: 100 }]).some((issue) => issue.includes("080")));

const isFile = buildIsFile("001234567000012", 2026, 10000, 20);
assert.match(isFile, /IS;PREPARATOIRE/);
assert.match(isFile, /IS_ESTIME;2000.00/);
assert.match(isFile, /DEPOT;MANUEL/);
assert.match(buildIsFile("", 2026, -500, null), /TAUX_POURCENT;NON_RENSEIGNE/);
assert.match(buildIsFile("", 2026, -500, null), /IS_ESTIME;NON_CALCULE/);

const bds = bdsIssues([{ cnssNumber: "12", lastName: "A", firstName: "B", days: 30, gross: 1000, capped: 7000 }], 6000);
assert.equal(bds.length, 4);
assert.deepEqual(bdsIssues([{ cnssNumber: "123456", lastName: "A", firstName: "B", days: 26, gross: 8000, capped: 6000 }], 6000), []);

const ir = irIssues([{ employeeNumber: "E1", fullName: "", cin: "ZZ", taxable: 100, irWithheld: 150, dependents: 0 }]);
assert.ok(ir.length >= 2);
assert.equal(controlTrailer([]), "CONTROLE;0\n");
assert.match(controlTrailer(["ICE"]), /CONTROLE;1/);

assert.equal(frenchStatusLabel("calculated"), "Calculé");
assert.equal(frenchStatusLabel("validated"), "Validé");
assert.equal(frenchStatusLabel("paid"), "Payé");
assert.equal(frenchStatusLabel("archived"), "Archivé");
const party = { code: partyAuxiliaryCode("CL-01", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), name: "Atlas Négoce" };
assert.deepEqual(fecAuxiliaryColumns("3421", undefined, party), { number: "CL-01", label: "Atlas Négoce" });
assert.deepEqual(fecAuxiliaryColumns("4411", undefined, party), { number: "CL-01", label: "Atlas Négoce" });
assert.deepEqual(fecAuxiliaryColumns("3421", { code: "3421-AUX", name: "Auxiliaire" }, party), { number: "3421-AUX", label: "Auxiliaire" });
assert.deepEqual(fecAuxiliaryColumns("7111", undefined, party), { number: "", label: "" });

console.log("Fichiers fiscaux préparatoires : SIMPL, IS, BDS et 9421 contrôlés.");
