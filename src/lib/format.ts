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
  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
