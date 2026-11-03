const madFormatter = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("fr-MA");

export function formatMoney(value: number | null | undefined) {
  return madFormatter.format(value ?? 0);
}

export function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(value ?? 0);
}

export function formatDate(value: string | Date) {
  // SQL DATE values are calendar dates, not instants. Keep their day intact
  // when the same document is rendered on the server and in the browser.
  const isCalendarDate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: isCalendarDate ? "UTC" : undefined,
  }).format(new Date(value));
}
