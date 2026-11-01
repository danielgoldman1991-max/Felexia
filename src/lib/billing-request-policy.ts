import { getAppUrl } from "@/lib/app-url";

type BillingRejection = { status: 403 | 429; code: string; error: string; retryAfter?: number };
type BillingWindow = { minuteStart: number; minuteCount: number; hourStart: number; hourCount: number };
const windows = new Map<string, BillingWindow>();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Local-instance abuse guard, additional to authentication and the SQL Checkout lease. */
export function getBillingRequestRejection(request: Request, organizationId: string): BillingRejection | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  let allowedOrigin = false;
  try {
    const requestedOrigin = new URL(request.url).origin;
    const configuredOrigin = new URL(getAppUrl()).origin;
    allowedOrigin = Boolean(origin && (origin === requestedOrigin || origin === configuredOrigin));
  } catch { /* An invalid origin or URL must never authorize a billing request. */ }
  if (!allowedOrigin || (fetchSite && !["same-origin", "same-site"].includes(fetchSite))) {
    return { status: 403, code: "BILLING_ORIGIN_NOT_ALLOWED", error: "Ouvrez la facturation depuis votre espace Felexia." };
  }

  const now = Date.now();
  if (windows.size >= 5_000) for (const [key, value] of windows) if (now - value.hourStart >= HOUR) windows.delete(key);
  if (!windows.has(organizationId) && windows.size >= 10_000) {
    return { status: 429, code: "BILLING_RATE_LIMITED", error: "La facturation reçoit trop de demandes. Réessayez dans une minute.", retryAfter: 60 };
  }
  const entry = windows.get(organizationId) ?? { minuteStart: now, minuteCount: 0, hourStart: now, hourCount: 0 };
  if (now - entry.minuteStart >= MINUTE) { entry.minuteStart = now; entry.minuteCount = 0; }
  if (now - entry.hourStart >= HOUR) { entry.hourStart = now; entry.hourCount = 0; }
  if (entry.minuteCount >= 10 || entry.hourCount >= 60) {
    const resetAt = Math.max(entry.minuteCount >= 10 ? entry.minuteStart + MINUTE : now, entry.hourCount >= 60 ? entry.hourStart + HOUR : now);
    return { status: 429, code: "BILLING_RATE_LIMITED", error: "Trop de demandes de facturation. Patientez avant de réessayer.", retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1_000)) };
  }
  entry.minuteCount += 1;
  entry.hourCount += 1;
  windows.set(organizationId, entry);
  return null;
}
