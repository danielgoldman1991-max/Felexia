import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchema } from "@/lib/optional-schema";

export const PERIOD_LOCKED_MESSAGE = "Cette période est verrouillée. Déverrouillez le mois dans Exercices avant de valider ou de comptabiliser une pièce à cette date.";

export function periodLockedMessage(name?: string | null) {
  if (!name) return PERIOD_LOCKED_MESSAGE;
  return `La période ${name} est verrouillée. Déverrouillez-la dans Exercices avant de valider ou de comptabiliser une pièce à cette date.`;
}

export function isPeriodLocked(period: { status?: string | null; locked_at?: string | null } | null | undefined) {
  if (!period) return false;
  return period.status === "locked" || period.status === "closed" || Boolean(period.locked_at);
}

/** Server-side refusal. A missing periods table does not block posting. */
export async function assertDateInOpenPeriod(supabase: SupabaseClient, organizationId: string, date: string | null | undefined) {
  const day = String(date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const { data, error } = await supabase
    .from("accounting_periods")
    .select("name, status, locked_at, start_date, end_date")
    .eq("organization_id", organizationId)
    .lte("start_date", day)
    .gte("end_date", day);
  if (error) {
    if (isMissingSchema(error)) return;
    throw new Error(PERIOD_LOCKED_MESSAGE);
  }
  const locked = (data ?? []).find((period) => isPeriodLocked(period));
  if (locked) throw new Error(periodLockedMessage(locked.name as string | undefined));
}
