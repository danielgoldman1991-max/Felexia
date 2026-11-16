import { NextRequest, NextResponse } from "next/server";
import { collectOrganizationBackup } from "@/lib/backup/collect";
import { hasFullErpAccess } from "@/lib/launch-access";
import {
  BACKUP_BUCKET,
  type BackupScheduleInput,
  backupObjectPath,
  decideSlot,
  dueSlot,
  runsToPurge,
} from "@/lib/backup/schedule";

type DbResult = { data: unknown; error: { message: string; code?: string } | null };
type Filter = {
  select: (columns: string) => Filter;
  insert: (values: Record<string, unknown>) => Filter;
  update: (values: Record<string, unknown>) => Filter;
  eq: (column: string, value: string | boolean | null) => Filter;
  order: (column: string, options?: { ascending: boolean }) => Filter;
  limit: (count: number) => Filter;
  range: (from: number, to: number) => Promise<DbResult>;
  maybeSingle: () => Promise<DbResult>;
  then: Promise<DbResult>["then"];
};

type BackupClient = {
  from: (table: string) => Filter;
  storage: { from: (bucket: string) => { upload: (path: string, body: Buffer, options: { contentType: string; upsert: boolean }) => Promise<{ error: { message: string } | null }>; remove: (paths: string[]) => Promise<unknown> } };
};

type ScheduleRow = {
  id: string;
  organization_id: string;
  enabled: boolean;
  frequency: string;
  weekdays: number[] | null;
  month_day: number;
  hour: number;
  minute: number;
  retention_count: number;
};

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_ORGS = 8;
const MAX_MS = 25_000;
const MAX_BYTES = 20_971_520;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function scheduleOf(row: {
  enabled: boolean;
  frequency: string;
  weekdays: number[] | null;
  month_day: number;
  hour: number;
  minute: number;
  retention_count: number;
}): BackupScheduleInput {
  return {
    enabled: row.enabled,
    frequency: row.frequency === "weekly" || row.frequency === "monthly" ? row.frequency : "daily",
    weekdays: row.weekdays ?? [1],
    monthDay: row.month_day,
    hour: row.hour,
    minute: row.minute,
    retentionCount: row.retention_count,
  };
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[BACKUP_CRON] missing server credential");
    return NextResponse.json({ error: "Service temporairement indisponible" }, { status: 503, headers: NO_STORE });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401, headers: NO_STORE });
  }

  const started = Date.now();
  let done = 0;
  let failed = 0;
  let skipped = 0;
  try {
    const { createClient: createServiceClient } = await import("@/lib/supabase/service");
    const supabase = createServiceClient() as unknown as BackupClient;
    const { data: rows, error } = await supabase
      .from("organization_backup_schedules")
      .select("id, organization_id, enabled, frequency, weekdays, month_day, hour, minute, retention_count")
      .eq("enabled", true)
      .order("organization_id", { ascending: true })
      .limit(100);
    if (error) throw new Error(error.message);
    const now = new Date();
    for (const row of (Array.isArray(rows) ? rows : []) as ScheduleRow[]) {
      if (done + failed >= MAX_ORGS || Date.now() - started > MAX_MS) break;
      const schedule = scheduleOf(row);
      const due = dueSlot(schedule, now);
      if (!due) {
        skipped += 1;
        continue;
      }
      const outcome = await runOne(supabase, row, due.key, due.at, now);
      if (outcome === "ok") done += 1;
      else if (outcome === "failed") failed += 1;
      else skipped += 1;
    }
    console.info("[BACKUP_CRON] batch completed", { done, failed, skipped, durationMs: Date.now() - started });
    return NextResponse.json({ done, failed, skipped }, { headers: NO_STORE });
  } catch {
    console.error("[BACKUP_CRON] batch failed", { done, failed });
    return NextResponse.json({ error: "Le traitement des sauvegardes n’a pas pu être terminé.", done, failed }, { status: 503, headers: NO_STORE });
  }
}

async function runOne(
  supabase: BackupClient,
  row: { id: string; organization_id: string; retention_count: number },
  slotKey: string,
  slotAt: Date,
  now: Date,
): Promise<"ok" | "failed" | "skipped"> {
  const found = await supabase
    .from("organization_backup_runs")
    .select("id, status, started_at")
    .eq("organization_id", row.organization_id)
    .eq("slot_key", slotKey)
    .maybeSingle();
  const existing = found.data as { id?: string; status?: string; started_at?: string } | null;
  const decision = decideSlot(existing?.status && existing.started_at ? { status: existing.status, startedAt: existing.started_at } : null, now);
  if (decision === "skip") return "skipped";

  let runId = existing?.id;
  if (!runId) {
    const inserted = await supabase
      .from("organization_backup_runs")
      .insert({ organization_id: row.organization_id, schedule_id: row.id, slot_key: slotKey, status: "running", started_at: now.toISOString() })
      .select("id")
      .maybeSingle();
    if (inserted.error) return inserted.error.code === "23505" ? "skipped" : "failed";
    const created = inserted.data as { id?: string } | null;
    runId = created?.id;
  } else {
    await supabase.from("organization_backup_runs").update({ status: "running", started_at: now.toISOString(), error_message: null, finished_at: null }).eq("id", runId).eq("organization_id", row.organization_id);
  }
  if (!runId) return "failed";

  try {
    const organization = await supabase.from("organizations").select("name").eq("id", row.organization_id).maybeSingle();
    const name = (organization.data as { name?: string } | null)?.name || "Entreprise";
    const includeHr = await hasFullErpAccess(row.organization_id, supabase as unknown as Parameters<typeof hasFullErpAccess>[1]);
    const backup = await collectOrganizationBackup(supabase as unknown as Parameters<typeof collectOrganizationBackup>[0], {
      organizationId: row.organization_id,
      organizationName: name,
      includeHr,
      createdAt: slotAt.toISOString(),
    });
    if (backup.zip.length > MAX_BYTES) throw new Error("La sauvegarde dépasse 20 Mo.");
    const path = backupObjectPath(row.organization_id, runId);
    const uploaded = await supabase.storage.from(BACKUP_BUCKET).upload(path, backup.zip, { contentType: "application/zip", upsert: true });
    if (uploaded.error) throw new Error("Le fichier n’a pas pu être conservé.");
    const finished = new Date().toISOString();
    await supabase.from("organization_backup_runs").update({ status: "ok", byte_size: backup.zip.length, storage_path: path, error_message: null, finished_at: finished }).eq("id", runId).eq("organization_id", row.organization_id);
    await rotate(supabase, row.organization_id, row.retention_count);
    return "ok";
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "La sauvegarde a échoué.";
    await supabase.from("organization_backup_runs").update({ status: "failed", error_message: message, finished_at: new Date().toISOString() }).eq("id", runId).eq("organization_id", row.organization_id);
    return "failed";
  }
}

async function rotate(supabase: BackupClient, organizationId: string, retentionCount: number) {
  const listed = await supabase
    .from("organization_backup_runs")
    .select("id, status, finished_at, storage_path")
    .eq("organization_id", organizationId)
    .eq("status", "ok");
  const data = (Array.isArray(listed.data) ? listed.data : []) as { id: string; status: string; finished_at: string | null; storage_path: string | null }[];
  const purge = new Set(runsToPurge(data.map((run) => ({ id: run.id, status: run.status, finishedAt: run.finished_at ?? "" })), retentionCount));
  for (const run of data) {
    if (!purge.has(run.id)) continue;
    if (run.storage_path) await supabase.storage.from(BACKUP_BUCKET).remove([run.storage_path]);
    await supabase.from("organization_backup_runs").update({ status: "purged", storage_path: null }).eq("id", run.id).eq("organization_id", organizationId);
  }
}
