import assert from "node:assert/strict";
import { calculateMoroccanPayslip2026 } from "../src/lib/hr/ma-payroll-2026";
import { buildPreparatoryBds } from "../src/lib/hr/bds";
import { buildEtat9421 } from "../src/lib/hr/etat-9421";
import { acquiredLeaveDays, leaveBalance } from "../src/lib/hr/leave-balance";

const base = calculateMoroccanPayslip2026({ baseSalary: 6000, hireDate: "2020-01-01", periodDate: "2026-11-01" });
assert.equal(base.cnssEmployee, 268.8);
assert.ok(base.seniorityBonus > 0);
assert.equal(base.netToPay, base.net);
const withAdvance = calculateMoroccanPayslip2026({ baseSalary: 6000, advanceDeduction: 500, hireDate: "2024-01-01", periodDate: "2026-11-01" });
assert.equal(withAdvance.netToPay, Math.round((withAdvance.net - 500) * 100) / 100);

const bds = buildPreparatoryBds("202611", [{ cnssNumber: "123", lastName: "Alami", firstName: "Sara", days: 26, gross: 8000, capped: 6000 }]);
assert.match(bds, /^BDS;PREPARATOIRE/);
assert.match(bds, /SAL;123;Alami;Sara;26;8000.00;6000.00/);
assert.match(bds, /FIN;1/);

const etat = buildEtat9421(2026, [{ employeeNumber: "E1", fullName: "Sara Alami", cin: "AB123", taxable: 50000, irWithheld: 1200, dependents: 2 }]);
assert.match(etat, /ETAT9421;PREPARATOIRE;ANNEE;2026/);
assert.match(etat, /50000.00;1200.00;2/);

assert.equal(acquiredLeaveDays(12), 18);
assert.deepEqual(leaveBalance(12, 6), { acquired: 18, taken: 6, remaining: 12 });
console.log("Paie : bulletin 2026, avance, BDS préparatoire, état 9421 et solde de congés vérifiés.");
