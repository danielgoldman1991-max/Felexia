export const BACKUP_TIME_ZONE = "Africa/Casablanca";
export const BACKUP_BUCKET = "organization-backups";
export const RETENTION_MIN = 3;
export const RETENTION_MAX = 30;
export const STALE_RUNNING_MS = 10 * 60 * 1000;

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
] as const;

export type BackupFrequency = "daily" | "weekly" | "monthly";

export type BackupScheduleInput = {
  enabled: boolean;
  frequency: BackupFrequency;
  weekdays: number[];
  monthDay: number;
  hour: number;
  minute: number;
  retentionCount: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function backupTimeOptions() {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    options.push(`${String(hour).padStart(2, "0")}:00`, `${String(hour).padStart(2, "0")}:30`);
  }
  return options;
}

export function parseBackupSchedule(input: {
  enabled: boolean;
  frequency: string;
  weekdays: number[];
  monthDay: number;
  time: string;
  retentionCount: number;
}): BackupScheduleInput {
  if (input.frequency !== "daily" && input.frequency !== "weekly" && input.frequency !== "monthly") {
    throw new Error("La fréquence doit être quotidienne, hebdomadaire ou mensuelle.");
  }
  const weekdays = [...new Set(input.weekdays.filter((day) => day >= 1 && day <= 7))].sort((a, b) => a - b);
  if (input.frequency === "weekly" && weekdays.length === 0) throw new Error("Choisissez au moins un jour de la semaine.");
  if (!Number.isInteger(input.monthDay) || input.monthDay < 1 || input.monthDay > 31) throw new Error("Le jour du mois doit être compris entre 1 et 31.");
  const match = /^(\d{2}):(\d{2})$/.exec(input.time);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  if (!match || hour < 0 || hour > 23 || (minute !== 0 && minute !== 30)) throw new Error("L’heure doit être un créneau de 30 minutes, de 00:00 à 23:30.");
  if (!Number.isInteger(input.retentionCount) || input.retentionCount < RETENTION_MIN || input.retentionCount > RETENTION_MAX) {
    throw new Error("Conservez entre 3 et 30 copies.");
  }
  return {
    enabled: input.enabled,
    frequency: input.frequency,
    weekdays: weekdays.length ? weekdays : [1],
    monthDay: input.monthDay,
    hour,
    minute,
    retentionCount: input.retentionCount,
  };
}

type Civil = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function zonedParts(date: Date, timeZone = BACKUP_TIME_ZONE): Civil {
  const bag = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const hour = bag.hour === "24" ? 0 : Number(bag.hour);
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday: WEEKDAY_INDEX[bag.weekday] ?? 1,
  };
}

function offsetMs(instant: Date, timeZone: string) {
  const parts = zonedParts(instant, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant.getTime();
}

export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone = BACKUP_TIME_ZONE) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMs(new Date(utc), timeZone);
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayOf(year: number, month: number, day: number) {
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}

function slotMatches(schedule: BackupScheduleInput, year: number, month: number, day: number) {
  if (schedule.frequency === "daily") return true;
  if (schedule.frequency === "weekly") return schedule.weekdays.includes(weekdayOf(year, month, day));
  return day === Math.min(schedule.monthDay, daysInMonth(year, month));
}

function shiftDate(year: number, month: number, day: number, delta: number) {
  const next = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

export function slotKey(year: number, month: number, day: number, hour: number, minute: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export function nextBackupRun(schedule: BackupScheduleInput, now: Date): Date | null {
  if (!schedule.enabled) return null;
  const start = zonedParts(now);
  for (let delta = 0; delta < 370; delta += 1) {
    const date = shiftDate(start.year, start.month, start.day, delta);
    if (!slotMatches(schedule, date.year, date.month, date.day)) continue;
    const instant = zonedToUtc(date.year, date.month, date.day, schedule.hour, schedule.minute);
    if (instant.getTime() > now.getTime()) return instant;
  }
  return null;
}

/** Latest scheduled instant at or before now. Older missed slots are not replayed. */
export function dueSlot(schedule: BackupScheduleInput, now: Date): { at: Date; key: string } | null {
  if (!schedule.enabled) return null;
  const start = zonedParts(now);
  for (let delta = 0; delta < 370; delta += 1) {
    const date = shiftDate(start.year, start.month, start.day, -delta);
    if (!slotMatches(schedule, date.year, date.month, date.day)) continue;
    const at = zonedToUtc(date.year, date.month, date.day, schedule.hour, schedule.minute);
    if (at.getTime() <= now.getTime()) return { at, key: slotKey(date.year, date.month, date.day, schedule.hour, schedule.minute) };
  }
  return null;
}

export function decideSlot(existing: { status: string; startedAt: string } | null, now: Date): "run" | "skip" {
  if (!existing) return "run";
  if (existing.status === "running" && now.getTime() - new Date(existing.startedAt).getTime() > STALE_RUNNING_MS) return "run";
  return "skip";
}

export function selectDueBackups(
  schedules: { organizationId: string; schedule: BackupScheduleInput }[],
  existing: Record<string, { status: string; startedAt: string } | null>,
  now: Date,
) {
  return schedules.flatMap((item) => {
    const due = dueSlot(item.schedule, now);
    if (!due) return [];
    const claim = `${item.organizationId}:${due.key}`;
    if (decideSlot(existing[claim] ?? null, now) === "skip") return [];
    return [{ organizationId: item.organizationId, slotKey: due.key, at: due.at.toISOString() }];
  });
}

export function runsToPurge(runs: { id: string; status: string; finishedAt: string }[], retentionCount: number) {
  const kept = runs
    .filter((run) => run.status === "ok")
    .sort((left, right) => right.finishedAt.localeCompare(left.finishedAt));
  return kept.slice(retentionCount).map((run) => run.id);
}

export function backupObjectPath(organizationId: string, runId: string) {
  if (!UUID.test(organizationId) || !UUID.test(runId)) throw new Error("Identifiant de sauvegarde refusé.");
  return `organizations/${organizationId}/${runId}.zip`;
}

export function backupPathBelongsTo(path: string, organizationId: string) {
  if (!UUID.test(organizationId) || path.includes("..") || path.includes("\\")) return false;
  return path.startsWith(`organizations/${organizationId}/`) && path.endsWith(".zip");
}

export function formatBackupWhen(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: BACKUP_TIME_ZONE, dateStyle: "full", timeStyle: "short" }).format(date);
}

export function formatBackupSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
