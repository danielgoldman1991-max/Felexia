export function formatIsoDateToFr(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function parseFrDateToIso(value: string): string {
  const cleaned = value.replace(/[-\s]/g, "/");
  const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const dd = match[1], mm = match[2], yyyy = match[3];
  const d = parseInt(dd, 10), m = parseInt(mm, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${yyyy}-${mm}-${dd}`;
}

export function isValidFrDate(value: string): boolean {
  return parseFrDateToIso(value).length > 0;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
