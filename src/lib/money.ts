export function parseLocalizedMoney(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");
  if (!normalized || !/^-?\d*(?:\.\d{0,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function canonicalMoney(value: string | number | null | undefined) {
  const parsed = parseLocalizedMoney(value);
  return parsed === null ? "" : (Math.round((parsed + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function moneyInputText(value: string | number | null | undefined) {
  const parsed = parseLocalizedMoney(value);
  if (parsed === null) return "";
  return new Intl.NumberFormat("fr-MA", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
}
