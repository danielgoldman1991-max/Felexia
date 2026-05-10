export const COUNTRY_OPTIONS = [
  { value: "MA", label: "Maroc" },
  { value: "FR", label: "France" },
  { value: "ES", label: "Espagne" },
  { value: "PT", label: "Portugal" },
  { value: "IT", label: "Italie" },
  { value: "DE", label: "Allemagne" },
  { value: "BE", label: "Belgique" },
  { value: "NL", label: "Pays-Bas" },
  { value: "GB", label: "Royaume-Uni" },
  { value: "US", label: "États-Unis" },
  { value: "CA", label: "Canada" },
  { value: "AE", label: "Émirats arabes unis" },
  { value: "SA", label: "Arabie saoudite" },
  { value: "TR", label: "Turquie" },
  { value: "CN", label: "Chine" },
] as const;

export type CountryCode = (typeof COUNTRY_OPTIONS)[number]["value"];

export const CITY_OPTIONS_BY_COUNTRY: Record<string, string[]> = {
  MA: [
    "Casablanca", "Rabat", "Marrakech", "Fès", "Tanger", "Agadir",
    "Meknès", "Oujda", "Kénitra", "Tétouan", "Salé", "Mohammedia",
    "El Jadida", "Nador", "Beni Mellal", "Khouribga", "Safi", "Settat",
    "Laâyoune", "Dakhla", "Errachidia", "Ouarzazate", "Essaouira",
    "Taza", "Larache", "Al Hoceïma", "Berkane", "Guelmim", "Taroudant", "Ifrane",
  ],
  FR: [
    "Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux", "Lille",
    "Nantes", "Nice", "Strasbourg", "Montpellier",
  ],
  ES: [
    "Madrid", "Barcelone", "Valence", "Séville", "Malaga", "Bilbao",
    "Saragosse", "Alicante",
  ],
  PT: ["Lisbonne", "Porto", "Braga", "Coimbra", "Faro"],
  IT: ["Rome", "Milan", "Turin", "Naples", "Florence", "Bologne", "Venise"],
  DE: ["Berlin", "Munich", "Hambourg", "Francfort", "Cologne", "Düsseldorf", "Stuttgart"],
  BE: ["Bruxelles", "Anvers", "Liège", "Gand", "Charleroi", "Bruges"],
  NL: ["Amsterdam", "Rotterdam", "La Haye", "Utrecht", "Eindhoven"],
  GB: ["Londres", "Manchester", "Birmingham", "Liverpool", "Leeds", "Glasgow"],
  US: [
    "New York", "Los Angeles", "Chicago", "Houston", "Miami",
    "San Francisco", "Washington", "Boston",
  ],
  CA: ["Montréal", "Toronto", "Vancouver", "Ottawa", "Québec", "Calgary"],
  AE: ["Dubaï", "Abou Dhabi", "Sharjah", "Ajman"],
  SA: ["Riyad", "Djeddah", "Dammam", "La Mecque", "Médine"],
  TR: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"],
  CN: ["Pékin", "Shanghai", "Guangzhou", "Shenzhen", "Hangzhou"],
};

export function getCountryLabel(code: string | null | undefined): string {
  if (!code) return "Maroc";
  const found = COUNTRY_OPTIONS.find((c) => c.value === code);
  if (found) return found.label;
  if (code === "Maroc") return "Maroc";
  if (code === "France") return "France";
  return code;
}

export function getCitiesForCountry(code: string | null | undefined): string[] {
  if (!code) return CITY_OPTIONS_BY_COUNTRY.MA;
  const cities = CITY_OPTIONS_BY_COUNTRY[code];
  if (!cities) return [];
  return [...cities];
}

export function getDefaultCountry(): string {
  return "MA";
}

export function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const labelToCode: Record<string, string> = {
    "Maroc": "MA", "France": "FR", "Espagne": "ES", "Portugal": "PT",
    "Italie": "IT", "Allemagne": "DE", "Belgique": "BE", "Pays-Bas": "NL",
    "Royaume-Uni": "GB", "États-Unis": "US", "Canada": "CA",
    "Émirats arabes unis": "AE", "Arabie saoudite": "SA", "Turquie": "TR", "Chine": "CN",
  };
  if (labelToCode[code]) return labelToCode[code];
  const found = COUNTRY_OPTIONS.find((c) => c.value === code);
  if (found) return code;
  return code;
}
