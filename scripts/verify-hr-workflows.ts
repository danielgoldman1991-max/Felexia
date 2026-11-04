import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

console.log("RH : décisions de congé, solde de tout compte et contrôles d'accès vérifiés.");
