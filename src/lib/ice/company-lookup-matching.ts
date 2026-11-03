import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { normalizeCompanyName, parseCompanyLookupInput } from "@/lib/ice/ice";

export function matchingCompanyName(value: string): string {
  return normalizeCompanyName(value).normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Every word must match a complete word or a prefix of at least three
 * characters. An incomplete name is a suggestion, never an exact identity.
 */
function nameMatchRank(name: string, requested: string): number | null {
  if (!requested) return null;
  if (name === requested) return 0;
  const requestedWords = requested.split(" ");
  const words = name.split(" ");
  const allComplete = requestedWords.every((word) => words.includes(word));
  const allMatch = requestedWords.every((word) => words.includes(word) ||
    (word.length >= 3 && words.some((value) => value.startsWith(word))));
  if (!allMatch) return null;
  if (allComplete) return name.startsWith(`${requested} `) ? 1 : 2;
  return name.startsWith(requested) ? 3 : 4;
}

function stableIdentityKey(company: CompanyLookupResult): string {
  return [matchingCompanyName(company.raisonSociale ?? ""), company.ice, company.raisonSociale,
    company.rc, company.villeRc, company.formeJuridique, company.activite, company.source].join("\0");
}

/** Rank complete source records, retaining one entire record per ICE. Fields
 * from different sources are never combined into a fabricated identity.
 */
export function selectCompanyLookupResults(companies: CompanyLookupResult[], query: string): CompanyLookupResponse {
  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) return { status: "invalid_input", message: parsed.error ?? "Recherche invalide." };
  const requested = matchingCompanyName(parsed.normalizedValue);
  const ranked = companies.slice(0, 100).filter((company) => company.found && company.raisonSociale && /^\d{15}$/.test(company.ice ?? ""))
    .map((company) => ({
      company,
      rank: parsed.type === "ice" ? (company.ice === parsed.normalizedValue ? 0 : null)
        : nameMatchRank(matchingCompanyName(company.raisonSociale ?? ""), requested),
      key: stableIdentityKey(company),
    })).filter((entry): entry is typeof entry & { rank: number } => entry.rank !== null)
    .sort((left, right) => left.rank - right.rank || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  const seen = new Set<string>();
  const unique = ranked.filter(({ company }) => {
    if (seen.has(company.ice!)) return false;
    seen.add(company.ice!);
    return true;
  });
  const matches = unique.map((entry) => entry.company);
  if (!matches.length) return { status: "not_found", message: "Aucun résultat confirmé pour cette recherche." };
  const prefixOnlyMatch = parsed.type === "raison_sociale" && unique.some((entry) => entry.rank >= 3);
  if (matches.length > 1 || prefixOnlyMatch) return {
    status: "ambiguous",
    message: matches.length === 1
      ? "Une entreprise proche de votre recherche est proposée. Vérifiez son nom et ses identifiants avant de la choisir."
      : "Plusieurs entreprises correspondent à votre recherche. Sélectionnez celle qui vous concerne.",
    candidates: matches.slice(0, 10),
    // Count only the relevant identities available in these bounded responses.
    candidateCount: matches.length,
    candidatesTruncated: matches.length > 10,
  };
  return { status: "found", message: "Entreprise trouvée. Vérifiez ses informations avant de continuer.", result: matches[0] };
}
