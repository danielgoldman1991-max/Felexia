import { lookupCompanyOnSyntaIq } from "@/lib/ice/providers/syntaiq";

export type CompanyLookupResult = {
  source: "synta-iq" | "marocfacture" | "manual" | "cache";
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
  status: "found" | "not_found" | "unavailable" | "blocked" | "invalid_input";
  message: string;
  result?: CompanyLookupResult;
};

export async function lookupCompany(query: string): Promise<CompanyLookupResponse> {
  return lookupCompanyOnSyntaIq(query);
}
