"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { CompanyOnboardingPrefill } from "@/lib/company-lookup/types";
import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { parseCompanyLookupInput } from "@/lib/ice/ice";
import { Button } from "@/components/ui/button";

type LookupPayload = {
  query: string;
  result: CompanyOnboardingPrefill;
};

function manualPayloadFromQuery(query: string): LookupPayload | null {
  const parsed = parseCompanyLookupInput(query);
  if (!parsed.isValid) return null;

  return {
    query: parsed.normalizedValue,
    result: {
      source: "manual",
      ice: parsed.type === "ice" ? parsed.normalizedValue : undefined,
      raisonSociale: parsed.type === "raison_sociale" ? parsed.normalizedValue : undefined,
    },
  };
}

function payloadFromResult(result: CompanyLookupResult): LookupPayload {
  return {
    query: result.query,
    result: {
      source: result.source,
      raisonSociale: result.raisonSociale ?? null,
      ice: result.ice ?? null,
      identifiantFiscal: result.identifiantFiscal ?? null,
      rc: result.rc ?? null,
      villeRc: result.villeRc ?? null,
      formeJuridique: result.formeJuridique ?? null,
      adresse: result.adresse ?? null,
      ville: result.ville ?? null,
      activite: result.activite ?? null,
      confidence: result.confidence,
    },
  };
}

function matchingCandidates(response: CompanyLookupResponse | null): CompanyLookupResult[] {
  if (response?.status !== "ambiguous" || !Array.isArray(response.candidates)) return [];
  const seen = new Set<string>();
  const candidates: CompanyLookupResult[] = [];
  for (const candidate of response.candidates.slice(0, 100)) {
    if (!candidate || candidate.found !== true || typeof candidate.raisonSociale !== "string" ||
      !candidate.raisonSociale.trim() || typeof candidate.ice !== "string" || !/^\d{15}$/.test(candidate.ice) || seen.has(candidate.ice)) continue;
    seen.add(candidate.ice);
    candidates.push(candidate);
    if (candidates.length === 10) break;
  }
  return candidates;
}

/* ─── Skeleton loader ─── */
function SearchSkeleton() {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)] animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-[var(--surface-soft)]" />
        <div className="w-full space-y-2">
          <div className="h-4 w-1/3 rounded bg-[var(--surface-soft)]" />
          <div className="h-3 w-2/3 rounded bg-[var(--surface-soft)]" />
          <div className="h-3 w-1/2 rounded bg-[var(--surface-soft)]" />
          <div className="h-3 w-1/4 rounded bg-[var(--surface-soft)]" />
        </div>
      </div>
    </section>
  );
}

/* ─── Result modal ─── */
function ResultModal({
  result,
  onConfirm,
  onModify,
  onClose,
  onBack,
}: {
  result: CompanyLookupResult;
  onConfirm: () => void;
  onModify: () => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  const fields = [
    { label: "ICE", value: result.ice },
    { label: "Forme juridique", value: result.formeJuridique },
    { label: "RC", value: result.rc },
    { label: "Ville", value: result.ville },
    { label: "Adresse", value: result.adresse },
    { label: "Activité", value: result.activite },
  ].filter((f) => f.value);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="company-result-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key !== "Tab") return;
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg transition-all duration-200">
        <section className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)] p-6 shadow-[var(--shadow-lg)] md:p-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les informations de l’entreprise"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--info-soft)] text-[var(--info)] ring-1 ring-[var(--border)]">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h2 id="company-result-title" className="text-lg font-semibold text-[var(--popover-foreground)]">Entreprise trouvée</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Vérifiez les informations ci-dessous avant de continuer.
              </p>
            </div>
          </div>

          {result.raisonSociale && (
            <p className="mt-6 break-words text-xl font-semibold text-[var(--popover-foreground)] [overflow-wrap:anywhere]">{result.raisonSociale}</p>
          )}

          <div className="mt-4 grid gap-2">
            {fields.map((f) => (
              <div key={f.label} className="flex flex-col gap-1 rounded-2xl bg-[var(--surface-soft)]/60 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4">
                <span className="shrink-0 text-sm text-[var(--muted)]">{f.label}</span>
                <span className="min-w-0 break-words text-sm font-medium text-[var(--popover-foreground)] [overflow-wrap:anywhere] sm:flex-1 sm:text-right">{f.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" onClick={onConfirm}>
              <Check className="h-4 w-4" />
              Confirmer et continuer
            </Button>
            <Button type="button" variant="secondary" onClick={onModify}>
              Modifier manuellement
            </Button>
            {onBack ? <Button type="button" variant="secondary" onClick={onBack}>Retour aux résultats</Button> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── Not found state ─── */
function NotFoundState({ query, onManual, onRetry }: { query: string; onManual: () => void; onRetry: () => void }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-soft)] text-[var(--muted)] ring-1 ring-[var(--border)]">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Entreprise introuvable</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Aucun résultat confirmé pour <span className="font-mono text-[var(--foreground)]">{query}</span>.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Vous pouvez réessayer avec un autre identifiant ou continuer manuellement.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onManual}>
              Continuer manuellement
            </Button>
            <Button type="button" onClick={onRetry}>
              Réessayer
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CompanyLookupStep({
  onConfirm,
  onManual,
}: {
  onConfirm: (payload: LookupPayload) => void;
  onManual: (payload?: LookupPayload) => void;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<CompanyLookupResponse | null>(null);
  const [manualPayload, setManualPayload] = useState<LookupPayload | null>(null);
  const [selectedResult, setSelectedResult] = useState<CompanyLookupResult | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const searchInFlight = useRef(false);
  const retryAt = useRef(0);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRetrySeconds(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [retrySeconds]);

  async function handleSearch() {
    if (searchInFlight.current || Date.now() < retryAt.current) return;

    const parsed = parseCompanyLookupInput(query);
    if (!parsed.isValid) {
      setError(parsed.error ?? "Recherche invalide.");
      setResponse(null);
      setManualPayload(null);
      setSelectedResult(null);
      return;
    }

    const nextManualPayload = manualPayloadFromQuery(query);
    setManualPayload(nextManualPayload);
    setError(null);
    setResponse(null);
    setSelectedResult(null);
    searchInFlight.current = true;
    setIsLoading(true);

    try {
      const apiResponse = await fetch("/api/company/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: parsed.normalizedValue }),
      });

      const data = (await apiResponse.json().catch(() => null)) as CompanyLookupResponse | null;

      if (apiResponse.status === 429) {
        // Also understand a 429 from a tab opened before the new server release.
        const supplied = Number(data?.retryAfterSeconds ?? apiResponse.headers.get("Retry-After"));
        const seconds = Number.isFinite(supplied) && supplied > 0 ? Math.min(3600, Math.ceil(supplied)) : 30;
        retryAt.current = Date.now() + seconds * 1000;
        setRetrySeconds(seconds);
        setResponse({ status: "rate_limited", message: data?.message ?? "Limite de recherches atteinte.", retryAfterSeconds: seconds });
        return;
      }

      if (!data) {
        setResponse({
          status: "unavailable",
          message:
            "La recherche automatique n’a pas pu aboutir. Vous pouvez continuer manuellement avec les informations dont vous disposez.",
        });
        return;
      }

      if (!apiResponse.ok && data.status !== "not_found") {
        toast.error(data.message || "Erreur lors de la recherche.");
        setResponse(data);
        return;
      }

      setResponse(data);

      if (data.status === "found" && data.result) {
        toast.success("Entreprise trouvée !");
        setSelectedResult(data.result);
      }
    } catch {
      toast.error("La recherche automatique n’a pas pu aboutir.");
      setResponse({
        status: "unavailable",
        message:
          "La recherche automatique n’a pas pu aboutir. Vous pouvez continuer manuellement avec les informations dont vous disposez.",
      });
    } finally {
      searchInFlight.current = false;
      setIsLoading(false);
    }
  }

  function handleManual() {
    const nextPayload = manualPayloadFromQuery(query);
    onManual(nextPayload ?? undefined);
  }

  const canSearch = query.trim().length > 0 && !isLoading && retrySeconds === 0;
  const candidates = matchingCandidates(response);
  const foundPayload = selectedResult ? payloadFromResult(selectedResult) : null;

  return (
    <div className="space-y-6">
      {/* Search input card */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-6 shadow-[var(--shadow-sm)] md:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--border)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">
              Retrouvez votre entreprise
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Saisissez votre ICE ou votre raison sociale pour préremplir votre espace Felexia.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="company-lookup-query" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              ICE ou raison sociale
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                id="company-lookup-query"
                value={query}
                disabled={isLoading}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setError(null);
                  if (response?.status !== "rate_limited" || retrySeconds === 0) setResponse(null);
                  setManualPayload(null);
                  setSelectedResult(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder="ICE ou raison sociale"
                className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] pl-11 pr-4 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-2)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary)_15%,transparent)]"
              />
            </div>
            <button
              type="button"
              onClick={handleManual}
              className="mt-3 text-sm font-medium text-[var(--primary)] transition hover:underline"
            >
              Créer manuellement
            </button>
            {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
          </div>

          <Button
            type="button"
            onClick={() => void handleSearch()}
            disabled={!canSearch}
            className="self-end"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recherche en cours...
              </>
            ) : (
              "Rechercher"
            )}
          </Button>
        </div>
      </section>

      {/* Skeleton while loading */}
      {isLoading && !response && <SearchSkeleton />}

      {/* Result modal */}
      {selectedResult && foundPayload && (
        <ResultModal
          result={selectedResult}
          onConfirm={() => {
            setSelectedResult(null);
            onConfirm(foundPayload);
          }}
          onModify={() => {
            setSelectedResult(null);
            onManual(foundPayload);
          }}
          onClose={() => setSelectedResult(null)}
          onBack={candidates.length ? () => setSelectedResult(null) : undefined}
        />
      )}

      {candidates.length ? (
        <section aria-labelledby="company-candidates-heading" className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)] md:p-6">
          <h2 id="company-candidates-heading" className="text-lg font-semibold text-[var(--foreground)]">Choisissez votre entreprise</h2>
          <p role="status" className="mt-2 text-sm text-[var(--muted)]">
            {candidates.length} {candidates.length === 1 ? "entreprise proposée" : "entreprises proposées"}. Vérifiez le nom et les identifiants avant de choisir.
          </p>
          <ul className="mt-5 grid gap-3" aria-label="Entreprises proches de votre recherche">
            {candidates.map((candidate) => (
              <li key={candidate.ice} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold text-[var(--foreground)] [overflow-wrap:anywhere]">{candidate.raisonSociale}</h3>
                  <dl className="mt-2 grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="min-w-0"><dt className="inline text-[var(--muted)]">ICE : </dt><dd className="inline break-words font-medium [overflow-wrap:anywhere]">{candidate.ice}</dd></div>
                    {candidate.rc ? <div className="min-w-0"><dt className="inline text-[var(--muted)]">RC : </dt><dd className="inline break-words font-medium [overflow-wrap:anywhere]">{candidate.rc}</dd></div> : null}
                    {candidate.villeRc ? <div className="min-w-0"><dt className="inline text-[var(--muted)]">Ville du RC : </dt><dd className="inline break-words font-medium [overflow-wrap:anywhere]">{candidate.villeRc}</dd></div> : null}
                    {candidate.formeJuridique ? <div className="min-w-0"><dt className="inline text-[var(--muted)]">Forme : </dt><dd className="inline break-words [overflow-wrap:anywhere]">{candidate.formeJuridique}</dd></div> : null}
                  </dl>
                </div>
                <Button type="button" onClick={() => setSelectedResult(candidate)} aria-label={`Choisir ${candidate.raisonSociale}, ICE ${candidate.ice}`} className="w-full shrink-0 sm:w-auto">
                  Choisir cette entreprise
                </Button>
              </li>
            ))}
          </ul>
          {response?.candidatesTruncated ? <p className="mt-4 text-sm text-[var(--muted)]">D’autres entreprises correspondent. Ajoutez un mot au nom ou utilisez l’ICE pour affiner la recherche.</p> : null}
          <button type="button" onClick={handleManual} className="mt-4 text-sm font-medium text-[var(--primary)] hover:underline">Continuer manuellement</button>
        </section>
      ) : null}

      {/* Not found state */}
      {response?.status === "not_found" ? (
        <NotFoundState
          query={manualPayload?.query ?? query}
          onManual={handleManual}
          onRetry={() => void handleSearch()}
        />
      ) : null}

      {response && ["unavailable", "blocked", "invalid_input", "ambiguous"].includes(response.status) && !candidates.length ? (
        <section role="alert" className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {response.status === "invalid_input" ? "Vérifiez votre recherche" : response.status === "ambiguous" ? "Recherche à préciser" : "Recherche automatique indisponible"}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {response.message || "La recherche automatique n’a pas pu aboutir. Vous pouvez continuer manuellement."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleManual}>
              Continuer manuellement
            </Button>
            <Button type="button" onClick={() => void handleSearch()} disabled={isLoading}>
              Réessayer
            </Button>
          </div>
        </section>
      ) : null}

      {response?.status === "rate_limited" ? (
        <section role="status" className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {retrySeconds > 0 ? "Patientez avant de réessayer" : "Vous pouvez relancer la recherche"}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {retrySeconds > 0 ? `Limite de recherches atteinte. Nouvel essai possible dans ${retrySeconds} secondes.` : "Le délai est écoulé. Vous pouvez rechercher par ICE ou raison sociale."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleManual}>Continuer manuellement</Button>
            <Button type="button" onClick={() => void handleSearch()} disabled={isLoading || retrySeconds > 0}>
              {retrySeconds > 0 ? `Réessayer dans ${retrySeconds} s` : "Réessayer"}
            </Button>
          </div>
        </section>
      ) : null}

    </div>
  );
}
