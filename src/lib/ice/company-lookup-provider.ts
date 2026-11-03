import { lookupCompanyOnManagePro } from "@/lib/ice/providers/managepro";

export type CompanyLookupResult = {
  source: "managepro" | "synta-iq" | "manual" | "cache";
  query: string;
  found: boolean;
  raisonSociale?: string | null;
  ice?: string | null;
  identifiantFiscal?: string | null;
  rc?: string | null;
  villeRc?: string | null;
  formeJuridique?: string | null;
  adresse?: string | null;
  ville?: string | null;
  activite?: string | null;
  raw?: Record<string, unknown> | null;
  confidence: "low" | "medium" | "high";
};

export type CompanyLookupResponse = {
  status: "found" | "not_found" | "ambiguous" | "rate_limited" | "unavailable" | "blocked" | "invalid_input";
  message: string;
  retryAfterSeconds?: number;
  result?: CompanyLookupResult;
  /** Matching identities from the bounded source response; requires user choice. */
  candidates?: CompanyLookupResult[];
  candidateCount?: number;
  candidatesTruncated?: boolean;
};

export async function lookupCompany(query: string): Promise<CompanyLookupResponse> {
  return lookupCompanyOnManagePro(query);
}
