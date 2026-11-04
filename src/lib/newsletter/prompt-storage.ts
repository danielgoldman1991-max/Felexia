export const NEWSLETTER_PROMPT_KEY = "felexia:newsletter-prompt:v1";
export const NEWSLETTER_PROMPT_DAYS = 30;
const WINDOW_MS = NEWSLETTER_PROMPT_DAYS * 24 * 60 * 60 * 1000;

export function promptRecord(now: number): { v: 1; until: number } {
  return { v: 1, until: now + WINDOW_MS };
}

export function promptHidden(raw: string | null, now: number): boolean {
  if (!raw) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    const record = parsed as { v?: unknown; until?: unknown };
    return record.v === 1 && typeof record.until === "number" && Number.isFinite(record.until) && record.until > now;
  } catch {
    return false;
  }
}
