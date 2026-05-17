export const MOROCCAN_CITIES = [
  "Casablanca",
  "Rabat",
  "Marrakech",
  "Fès",
  "Tanger",
  "Agadir",
  "Meknès",
  "Oujda",
  "Kénitra",
  "Tétouan",
  "Safi",
  "Mohammédia",
  "El Jadida",
  "Beni Mellal",
  "Nador",
  "Taza",
  "Khouribga",
  "Settat",
  "Larache",
  "Ksar El Kebir",
  "Guelmim",
  "Berrechid",
  "Errachidia",
  "Ouarzazate",
  "Essaouira",
  "Laâyoune",
  "Dakhla",
  "Salé",
  "Temara",
  "Inezgane",
  "Al Hoceïma",
];

export function normalizeMoroccanPhone(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("2120") && digits.length === 13) {
    digits = `212${digits.slice(4)}`;
  } else if (digits.startsWith("0") && digits.length === 10) {
    digits = `212${digits.slice(1)}`;
  } else if (!digits.startsWith("212") && digits.length === 9) {
    digits = `212${digits}`;
  }

  return digits.startsWith("212") && digits.length === 12 ? `+${digits}` : value.trim();
}

export function formatMoroccanPhone(value: string): string {
  const normalized = normalizeMoroccanPhone(value);
  const digits = normalized.replace(/\D/g, "");

  if (!digits) return "+212 ";

  if (digits.startsWith("212") && digits.length <= 12) {
    const national = digits.slice(3);
    const chunks = [
      national.slice(0, 3),
      national.slice(3, 5),
      national.slice(5, 7),
      national.slice(7, 9),
    ].filter(Boolean);

    return `+212${chunks.length ? ` ${chunks.join(" ")}` : " "}`;
  }

  return value;
}

export function isValidMoroccanPhone(value: string): boolean {
  const digits = normalizeMoroccanPhone(value).replace(/\D/g, "");
  return /^212[567]\d{8}$/.test(digits);
}
