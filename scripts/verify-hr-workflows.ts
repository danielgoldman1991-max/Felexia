import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { employeeCsvTemplate, employeeImportDecision, parseEmployeeCsv } from "../src/lib/hr/validation";
import { hrCatalogDeleteDecision } from "../src/lib/hr/settings-catalog";
import { decideLeave } from "../src/lib/hr/leave-decision";
import { serviceMonthsInYear } from "../src/lib/hr/leave-balance";
import { computeFinalSettlement } from "../src/lib/hr/settlement";
import { isCheckKey } from "../src/lib/hr/checks";

const approved = decideLeave({ status: "pending", days: 2, remainingDays: 12, decision: "approve", countsAgainstBalance: true });
assert.equal(approved.ok, true);
assert.equal(approved.nextStatus, "approved");
assert.equal(approved.takenDelta, 2);

const short = decideLeave({ status: "pending", days: 5, remainingDays: 1.5, decision: "approve", countsAgainstBalance: true });
assert.equal(short.ok, false);
assert.match(short.message, /Solde insuffisant/);

const unpaid = decideLeave({ status: "pending", days: 3, remainingDays: 0, decision: "approve", countsAgainstBalance: false });
assert.equal(unpaid.ok, true);
assert.equal(unpaid.takenDelta, 0);

const rejected = decideLeave({ status: "pending", days: 1, remainingDays: 4, decision: "reject", countsAgainstBalance: true });
assert.equal(rejected.nextStatus, "rejected");
assert.equal(rejected.takenDelta, 0);

const cancelled = decideLeave({ status: "approved", days: 2, remainingDays: 10, decision: "cancel", countsAgainstBalance: true });
assert.equal(cancelled.nextStatus, "cancelled");
assert.equal(cancelled.takenDelta, -2);

const closed = decideLeave({ status: "rejected", days: 1, remainingDays: 4, decision: "cancel", countsAgainstBalance: true });
assert.equal(closed.ok, false);

assert.equal(serviceMonthsInYear("2020-03-15", 2026, new Date("2026-11-04T00:00:00Z")), 11);
assert.equal(serviceMonthsInYear("2026-10-01", 2026, new Date("2026-11-04T00:00:00Z")), 2);

const settlement = computeFinalSettlement({
  monthlySalary: 6000,
  hireDate: "2020-01-01",
  exitDate: "2026-01-01",
  reason: "licenciement",
  remainingLeaveDays: 2,
  noticeDays: 8,
  noticePaid: false,
  lastNet: 4500,
});
assert.equal(settlement.monthsOfService, 72);
assert.equal(settlement.dismissalHours, 624);
assert.equal(settlement.eligibleForDismissal, true);
assert.ok(settlement.leaveIndemnity > 0);
assert.ok(settlement.noticeIndemnity > 0);
assert.equal(settlement.total, Math.round((settlement.leaveIndemnity + settlement.noticeIndemnity + settlement.dismissalIndemnity + settlement.lastNet) * 100) / 100);

const resignation = computeFinalSettlement({
  monthlySalary: 6000, hireDate: "2020-01-01", exitDate: "2026-01-01", reason: "demission",
  remainingLeaveDays: 0, noticeDays: 0, noticePaid: true, lastNet: 0,
});
assert.equal(resignation.dismissalIndemnity, 0);

const recent = computeFinalSettlement({
  monthlySalary: 6000, hireDate: "2026-06-01", exitDate: "2026-09-01", reason: "licenciement",
  remainingLeaveDays: 1, noticeDays: 0, noticePaid: true, lastNet: 0,
});
assert.equal(recent.eligibleForDismissal, false);
assert.equal(recent.dismissalIndemnity, 0);
const prorata = computeFinalSettlement({
  monthlySalary: 14000, hireDate: "2020-01-01", exitDate: "2026-01-15", reason: "demission",
  remainingLeaveDays: 15, noticeDays: 0, noticePaid: true, lastNet: 1000, daysWorked: 15,
});
assert.equal(prorata.salaryProrata, 8076.92);
assert.equal(prorata.leaveIndemnity, 8076.92);
assert.equal(prorata.total, 8076.92 + 8076.92 + 1000);

assert.equal(isCheckKey("onboarding", "cin"), true);
assert.equal(isCheckKey("offboarding", "pointeuse"), false);

for (const file of ["src/lib/hr/leave-actions.ts", "src/lib/hr/contract-actions.ts"]) {
  const source = readFileSync(file, "utf8");
  for (const chunk of source.split("export async function").slice(1)) {
    const call = chunk.indexOf("await createClient");
    const guard = chunk.indexOf("requireWritableHrWorkspace");
    assert.ok(guard >= 0 && (call === -1 || guard < call), `${file} vérifie le droit RH avant la base`);
  }
}

const migration = readFileSync("supabase/migrations/123_hr_leave_settlements_and_checks.sql", "utf8");
assert.match(migration, /aa_pro_member_write/);
assert.match(migration, /pro_read_guard_110/);
assert.match(migration, /official_claim = false/);
assert.match(readFileSync("supabase/rollbacks/123_hr_leave_settlements_and_checks_rollback.sql", "utf8"), /drop table if exists public.hr_final_settlements/);

const validRib = "000000000000000000000097";
const frenchCsv = [
  "Matricule;Prénom;Nom;Date d'embauche;Salaire;CIN;CNSS;RIB;Email;Ville;Personnes à charge",
  `E001;Sara;Alami;15/01/2024;8 000,00;AB123456;123456789;${validRib};sara@example.com;Casablanca;1`,
].join("\n");
const accepted = parseEmployeeCsv(frenchCsv);
assert.deepEqual(accepted.errors, []);
assert.equal(accepted.rows[0]?.hireDate, "2024-01-15");
assert.equal(accepted.rows[0]?.baseSalary, 8000);
assert.equal(accepted.rows[0]?.dependents, 1);
assert.equal(employeeImportDecision(accepted).ok, true);

const invalidFile = parseEmployeeCsv(`${frenchCsv}\nE001;Omar;Bennani;2024-02-01;1000;12;12345;123;mauvais;Rabat;9`);
assert.ok(invalidFile.errors.some((error) => error.includes("matricule")));
assert.ok(invalidFile.errors.some((error) => error.includes("CIN")));
assert.ok(invalidFile.errors.some((error) => error.includes("CNSS")));
assert.ok(invalidFile.errors.some((error) => error.includes("RIB")));
assert.ok(invalidFile.errors.some((error) => error.includes("email")));
assert.ok(invalidFile.errors.some((error) => error.includes("personnes")));
assert.equal(employeeImportDecision(invalidFile).ok, false);
assert.match(readFileSync("supabase/migrations/142_hr_employee_import.sql", "utf8"), /import_hr_employees_batch/);
assert.match(readFileSync("supabase/rollbacks/142_hr_employee_import_rollback.sql", "utf8"), /drop function if exists public.import_hr_employees_batch/);
const english = parseEmployeeCsv("employee_number;first_name;last_name;hire_date;base_salary;cin;cnss_number;rib;email;city;dependents\nE002;Sara;Alami;2024-01-15;8000;AB1;123456789;;sara@example.com;Rabat;0");
assert.deepEqual(english.errors, []);
assert.equal(english.rows[0]?.employeeNumber, "E002");
assert.equal(english.rows[0]?.city, "Rabat");
const unknownHeaders = parseEmployeeCsv("Matricule;Telephone\nE1;06");
assert.equal(unknownHeaders.errors.length, 1);
assert.match(unknownHeaders.errors[0] ?? "", /Colonnes manquantes : Prénom, Nom, Date d'embauche, Salaire/);
assert.match(unknownHeaders.errors[0] ?? "", /Colonnes inconnues : Telephone/);
assert.equal(unknownHeaders.errors.some((error) => error.startsWith("Ligne ")), false);
assert.match(employeeImportDecision(unknownHeaders).error ?? "", /^Les en-têtes/);
assert.match(employeeCsvTemplate(), /^Matricule;Prénom;Nom;Date d'embauche;Salaire;CIN;CNSS;RIB;Email;Ville;Personnes à charge\nE001;Sara;Alami;/);
const blocked = hrCatalogDeleteDecision("department", 2);
assert.equal(blocked.ok, false);
if (!blocked.ok) assert.match(blocked.error, /Archivez-le/);
assert.equal(hrCatalogDeleteDecision("schedule", 0).ok, true);

console.log("RH : décisions de congé, solde de tout compte et contrôles d'accès vérifiés.");
