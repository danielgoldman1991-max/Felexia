import { lookupCompanyOnManagePro } from "@/lib/ice/providers/managepro";
import { lookupCompanyOnMarocFacture } from "@/lib/ice/providers/marocfacture";
import { matchingCompanyName, selectCompanyLookupResults } from "@/lib/ice/company-lookup-matching";
import { parseCompanyLookupInput } from "@/lib/ice/ice";

export type CompanyLookupResult = {
  source: "managepro" | "marocfacture" | "synta-iq" | "manual" | "cache";
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
  /** Known count in bounded source cards; a lower bound after merging sources. */
  candidateCount?: number;
  candidatesTruncated?: boolean;
};

export async function lookupCompany(query: string): Promise<CompanyLookupResponse> {
  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) return { status: "invalid_input", message: parsed.error ?? "Recherche invalide." };
  if (parsed.normalizedValue.length > 100) return { status: "invalid_input", message: "Utilisez l’ICE ou une raison sociale de 100 caractères maximum." };
  const deadline = Date.now() + 15_000;
  const primary = await lookupCompanyOnManagePro(parsed.normalizedValue);
  const records = (response: CompanyLookupResponse) => response.status === "found" && response.result
    ? [response.result] : response.status === "ambiguous" ? response.candidates ?? [] : [];
  const primaryRecords = records(primary);
  const hasExact = primaryRecords.some((company) => parsed.type === "ice"
    ? company.ice === parsed.normalizedValue
    : matchingCompanyName(company.raisonSociale ?? "") === matchingCompanyName(parsed.normalizedValue));
  if (hasExact || primary.status === "invalid_input") return primary;
  const remainingMs = Math.max(0, Math.min(15_000, deadline - Date.now()));
  const secondary = remainingMs > 0
    ? await lookupCompanyOnMarocFacture(parsed.normalizedValue, remainingMs)
    : { status: "unavailable" as const, message: "La recherche automatique n’a pas pu aboutir." };
  const combined = selectCompanyLookupResults([...primaryRecords, ...records(secondary)], parsed.normalizedValue);
  if (combined.status === "ambiguous") {
    // A provider may retain ten choices from a larger bounded response. Keep
    // that known lower bound without adding counts whose ICEs may overlap.
    const candidateCount = Math.max(combined.candidateCount ?? 0, primary.candidateCount ?? 0, secondary.candidateCount ?? 0);
    return { ...combined, candidateCount, candidatesTruncated: Boolean(primary.candidatesTruncated || secondary.candidatesTruncated || candidateCount > (combined.candidates?.length ?? 0)) };
  }
  if (combined.status !== "not_found") return combined;
  if (primary.status === "not_found" && secondary.status === "not_found") return combined;
  return { status: "unavailable", message: "La recherche automatique est temporairement indisponible. Réessayez ou continuez manuellement." };
}
