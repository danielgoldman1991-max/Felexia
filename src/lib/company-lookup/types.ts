export type CompanyLookupResult = {
  ice: string | null;
  raisonSociale: string;
  formeJuridique?: string | null;
  adresse?: string | null;
  ville?: string | null;
  rc?: string | null;
  villeRc?: string | null;
  identifiantFiscal?: string | null;
  cnss?: string | null;
  source: "synta-iq" | "manual" | "cache";
  confidence?: number;
};

export type CompanyOnboardingPrefill = {
  source?: "synta-iq" | "manual" | "cache";
  raisonSociale?: string | null;
  ice?: string | null;
  identifiantFiscal?: string | null;
  rc?: string | null;
  villeRc?: string | null;
  cnss?: string | null;
  formeJuridique?: string | null;
  adresse?: string | null;
  ville?: string | null;
  activite?: string | null;
  confidence?: "low" | "medium" | "high" | number;
};

export type CompanyLookupErrorDebug = {
  query: string;
  errorMessage: string;
  step: string;
};
