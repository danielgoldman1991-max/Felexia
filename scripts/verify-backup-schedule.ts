import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOrganizationBackup, readOrganizationBackup } from "../src/lib/backup/org-backup";
import {
  backupObjectPath,
  backupPathBelongsTo,
  decideSlot,
  dueSlot,
  nextBackupRun,
  parseBackupSchedule,
  runsToPurge,
  selectDueBackups,
  zonedToUtc,
  type BackupScheduleInput,
} from "../src/lib/backup/schedule";

const casablanca = (year: number, month: number, day: number, hour: number, minute: number) => zonedToUtc(year, month, day, hour, minute);

const daily = (hour: number, minute: number, enabled = true): BackupScheduleInput => ({
  enabled, frequency: "daily", weekdays: [1], monthDay: 1, hour, minute, retentionCount: 7,
});

const beforeMorning = nextBackupRun(daily(8, 30), casablanca(2026, 11, 16, 7, 0));
assert.equal(beforeMorning?.toISOString(), casablanca(2026, 11, 16, 8, 30).toISOString());
const afterMorning = nextBackupRun(daily(8, 30), casablanca(2026, 11, 16, 9, 0));
assert.equal(afterMorning?.toISOString(), casablanca(2026, 11, 17, 8, 30).toISOString());
assert.equal(nextBackupRun({ ...daily(8, 30), enabled: false }, new Date()), null);

const weekly: BackupScheduleInput = { enabled: true, frequency: "weekly", weekdays: [2, 5], monthDay: 1, hour: 8, minute: 0, retentionCount: 7 };
assert.equal(nextBackupRun(weekly, casablanca(2026, 11, 18, 10, 0))?.toISOString(), casablanca(2026, 11, 20, 8, 0).toISOString());
assert.equal(nextBackupRun(weekly, casablanca(2026, 11, 21, 10, 0))?.toISOString(), casablanca(2026, 11, 24, 8, 0).toISOString());

const monthly: BackupScheduleInput = { enabled: true, frequency: "monthly", weekdays: [1], monthDay: 31, hour: 2, minute: 30, retentionCount: 7 };
assert.equal(nextBackupRun(monthly, casablanca(2026, 1, 31, 1, 0))?.toISOString(), casablanca(2026, 1, 31, 2, 30).toISOString());
assert.equal(nextBackupRun(monthly, casablanca(2026, 2, 1, 3, 0))?.toISOString(), casablanca(2026, 2, 28, 2, 30).toISOString());
assert.equal(nextBackupRun(monthly, casablanca(2028, 2, 1, 3, 0))?.toISOString(), casablanca(2028, 2, 29, 2, 30).toISOString());
assert.equal(nextBackupRun(monthly, casablanca(2026, 4, 1, 0, 0))?.toISOString(), casablanca(2026, 4, 30, 2, 30).toISOString());
assert.equal(nextBackupRun(monthly, casablanca(2026, 3, 1, 0, 0))?.toISOString(), casablanca(2026, 3, 31, 2, 30).toISOString());

const late = daily(23, 30);
const lateSlot = casablanca(2026, 11, 16, 23, 30);
assert.equal(nextBackupRun(late, new Date(lateSlot.getTime() - 60_000))?.toISOString(), lateSlot.toISOString());
assert.equal(nextBackupRun(late, new Date(lateSlot.getTime() + 60_000))?.toISOString(), casablanca(2026, 11, 17, 23, 30).toISOString());
assert.equal(dueSlot(late, new Date(lateSlot.getTime() + 60_000))?.key, "2026-11-16T23:30");
assert.equal(dueSlot(late, new Date(lateSlot.getTime() - 60_000))?.key, "2026-11-15T23:30");

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const now = new Date(lateSlot.getTime() + 60_000);
const due = selectDueBackups(
  [
    { organizationId: orgA, schedule: late },
    { organizationId: orgB, schedule: late },
  ],
  { [`${orgA}:2026-11-16T23:30`]: { status: "ok", startedAt: now.toISOString() } },
  now,
);
assert.deepEqual(due.map((item) => item.organizationId), [orgB]);
assert.equal(decideSlot({ status: "failed", startedAt: now.toISOString() }, now), "skip");
assert.equal(decideSlot({ status: "running", startedAt: new Date(now.getTime() - 11 * 60 * 1000).toISOString() }, now), "run");
assert.equal(decideSlot({ status: "running", startedAt: now.toISOString() }, now), "skip");

const purge = runsToPurge([
  { id: "new", status: "ok", finishedAt: "2026-11-16T00:00:00.000Z" },
  { id: "mid", status: "ok", finishedAt: "2026-11-15T00:00:00.000Z" },
  { id: "old", status: "ok", finishedAt: "2026-11-14T00:00:00.000Z" },
  { id: "older", status: "ok", finishedAt: "2026-11-13T00:00:00.000Z" },
  { id: "fail", status: "failed", finishedAt: "2026-11-12T00:00:00.000Z" },
], 3);
assert.deepEqual(purge, ["older"]);

const pathA = backupObjectPath(orgA, "33333333-3333-4333-8333-333333333333");
assert.equal(pathA.startsWith(`organizations/${orgA}/`), true);
assert.equal(backupPathBelongsTo(pathA, orgB), false);
assert.equal(backupPathBelongsTo(`organizations/${orgB}/../${orgA}/copie.zip`, orgA), false);
assert.throws(() => backupObjectPath(orgA, "pas-un-uuid"), /refusé/);
assert.throws(() => parseBackupSchedule({ enabled: true, frequency: "weekly", weekdays: [], monthDay: 1, time: "08:00", retentionCount: 7 }), /jour/);
assert.throws(() => parseBackupSchedule({ enabled: true, frequency: "daily", weekdays: [1], monthDay: 1, time: "08:15", retentionCount: 7 }), /30 minutes/);
assert.throws(() => parseBackupSchedule({ enabled: true, frequency: "daily", weekdays: [1], monthDay: 1, time: "08:00", retentionCount: 2 }), /3 et 30/);

const zip = buildOrganizationBackup({
  organizationId: orgA,
  organizationName: "Atelier Démo",
  createdAt: "2026-11-16T22:30:00.000Z",
  tables: [{ name: "third_parties", rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", organization_id: orgA, name: "Atelier Démo" }] }],
});
assert.equal(readOrganizationBackup(zip.zip).manifest.format, "felexia-backup");
const route = readFileSync("src/app/api/cron/organization-backups/route.ts", "utf8");
assert.equal(route.includes("collectOrganizationBackup"), true);
assert.equal(route.includes("CRON_SECRET"), true);
assert.equal(route.includes("Bearer"), true);
const manual = readFileSync("src/app/api/exports/sauvegarde/route.ts", "utf8");
assert.equal(manual.includes("collectOrganizationBackup"), true);

console.log("backup schedule: ok");
