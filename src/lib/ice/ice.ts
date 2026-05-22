export type CompanyLookupResult = {
  source: "manual" | "ice_maroc_external" | "api";
  raisonSociale?: string | null;
  ice?: string | null;
  formeJuridique?: string | null;
  rc?: string | null;
  villeRc?: string | null;
  identifiantFiscal?: string | null;
  cnss?: string | null;
  adresse?: string | null;
  ville?: string | null;
  activite?: string | null;
  confidence?: "low" | "medium" | "high";
};

export type CompanyLookupMode =
  | "manual"
  | "external_search"
  | "api_available"
  | "api_unavailable";

export type CompanyConfirmationInput = {
  raisonSociale: string;
  formeJuridique?: string;
  ice?: string;
  identifiantFiscal?: string;
  rc?: string;
  villeRc?: string;
  cnss?: string;
  adresse: string;
  ville: string;
  telephone: string;
  emailEnt: string;
  website?: string;
  activite?: string;
  secteur?: string;
};

export function normalizeIce(input: string): string {
  return input.replace(/\D/g, "");
}

export function isIceLike(input: string): boolean {
  const trimmed = input.trim();
  return /^\d[\d\s]*$/.test(trimmed);
}

export function validateIceFormat(ice: string): { valid: boolean; normalizedIce: string; error?: string } {
  const normalized = normalizeIce(ice);

  if (!/^\d{15}$/.test(normalized)) {
    return {
      valid: false,
      normalizedIce: normalized,
      error: "ICE invalide. L’ICE doit contenir quinze chiffres.",
    };
  }

  // Checksum ICE volontairement non bloquant tant qu'un algorithme officiel
  // fiable n'est pas configure dans Felexia. Ne jamais rejeter juridiquement un
  // ICE sur la base d'une hypothese de calcul.
  return { valid: true, normalizedIce: normalized };
}

export function validateIceChecksum(ice: string): { valid: boolean; expected?: string } {
  const normalized = normalizeIce(ice);
  if (!/^\d{15}$/.test(normalized)) return { valid: false };

  const base = BigInt(normalized.slice(0, 13));
  const modulo = BigInt(97);
  const expectedNumber = Number((modulo - ((base * BigInt(100)) % modulo)) % modulo);
  const expected = String(expectedNumber).padStart(2, "0");
  return {
    valid: normalized.slice(13) === expected,
    expected,
  };
}

export function buildIceMarocSearchUrl(query: string): string {
  const normalized = query.trim();
  const baseUrl = "https://www.icemaroc.com/";

  // L’intégration ICE externe est volontairement prudente. Toute automatisation
  // doit respecter les conditions d’utilisation de la source et les obligations
  // légales applicables.
  if (!normalized) return baseUrl;

  return `${baseUrl}?q=${encodeURIComponent(normalized)}`;
}

export function buildMarocFactureIceSearchUrl(query: string): string {
  const normalized = query.trim();
  const baseUrl = "https://ice.marocfacture.com/";

  if (!normalized) return baseUrl;

  const parsed = parseCompanyLookupInput(normalized);
  if (!parsed.isValid) return baseUrl;

  const param = parsed.type === "ice" ? "ice" : "nom";
  return `${baseUrl}?${param}=${encodeURIComponent(parsed.normalizedValue)}`;
}

export function normalizeCompanyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");
}

export function normalizeMoroccanPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("2120")) digits = `212${digits.slice(4)}`;
  if (digits.startsWith("0") && digits.length === 10) digits = `212${digits.slice(1)}`;
  if (!digits.startsWith("212") && digits.length === 9) digits = `212${digits}`;

  if (!digits.startsWith("212") || digits.length !== 12) return phone.trim();

  const national = digits.slice(3);
  return `+212 ${[
    national.slice(0, 3),
    national.slice(3, 5),
    national.slice(5, 7),
    national.slice(7, 9),
  ].filter(Boolean).join(" ")}`;
}

export function parseCompanyLookupInput(input: string): {
  type: "ice" | "raison_sociale";
  normalizedValue: string;
  isValid: boolean;
  error?: string;
} {
  const trimmed = input.trim().replace(/\s+/g, " ");

  if (isIceLike(trimmed)) {
    const normalizedValue = normalizeIce(trimmed);
    const validation = validateIceFormat(normalizedValue);
    return {
      type: "ice",
      normalizedValue,
      isValid: validation.valid,
      error: validation.error,
    };
  }

  const normalizedValue = normalizeCompanyName(trimmed);

  if (normalizedValue.length < 3) {
    return {
      type: "raison_sociale",
      normalizedValue,
      isValid: false,
      error: "Veuillez saisir au moins trois caractères.",
    };
  }

  return {
    type: "raison_sociale",
    normalizedValue,
    isValid: true,
  };
}

export function validateCompanyConfirmationInput(input: CompanyConfirmationInput): {
  valid: boolean;
  errors: Record<string, string>;
  normalized: CompanyConfirmationInput;
} {
  const normalized: CompanyConfirmationInput = {
    ...input,
    raisonSociale: normalizeCompanyName(input.raisonSociale),
    ice: input.ice ? normalizeIce(input.ice) : "",
    telephone: normalizeMoroccanPhone(input.telephone),
    emailEnt: input.emailEnt.trim().toLowerCase(),
    adresse: input.adresse.trim(),
    ville: input.ville.trim(),
    formeJuridique: input.formeJuridique?.trim() ?? "",
    identifiantFiscal: input.identifiantFiscal?.trim() ?? "",
    rc: input.rc?.trim() ?? "",
    villeRc: input.villeRc?.trim() ?? "",
    cnss: input.cnss?.trim() ?? "",
    website: input.website?.trim() ?? "",
    activite: input.activite?.trim() ?? "",
    secteur: input.secteur?.trim() ?? "",
  };

  const errors: Record<string, string> = {};

  if (normalized.raisonSociale.length < 2) errors.raisonSociale = "La raison sociale est obligatoire.";
  if (normalized.adresse.length < 5) errors.adresse = "L’adresse complète est obligatoire.";
  if (!normalized.ville) errors.ville = "La ville est obligatoire.";
  if (!normalized.telephone) errors.telephone = "Le numéro de téléphone est obligatoire.";
  if (!normalized.emailEnt) {
    errors.emailEnt = "L’adresse mail est obligatoire.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.emailEnt)) {
    errors.emailEnt = "L’adresse mail est invalide.";
  }

  if (normalized.ice) {
    const iceValidation = validateIceFormat(normalized.ice);
    if (!iceValidation.valid) errors.ice = iceValidation.error ?? "ICE invalide. Vérifiez les quinze chiffres saisis.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized,
  };
}
