"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Building2,
  Check,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { CompanyOnboardingPrefill } from "@/lib/company-lookup/types";
import type { CompanyLookupResponse, CompanyLookupResult } from "@/lib/ice/company-lookup-provider";
import { buildMarocFactureIceSearchUrl, parseCompanyLookupInput } from "@/lib/ice/ice";
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

/* ─── Skeleton loader ─── */
function SearchSkeleton() {
  return (
    <section className="premium-card rounded-[24px] border border-white/5 p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/10" />
        <div className="w-full space-y-2">
          <div className="h-4 w-1/3 rounded bg-white/10" />
          <div className="h-3 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/10" />
          <div className="h-3 w-1/4 rounded bg-white/10" />
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
}: {
  result: CompanyLookupResult;
  onConfirm: () => void;
  onModify: () => void;
  onClose: () => void;
}) {
  const fields = [
    { label: "ICE", value: result.ice },
    { label: "Forme juridique", value: result.formeJuridique },
    { label: "RC", value: result.rc },
    { label: "Ville", value: result.ville },
    { label: "Adresse", value: result.adresse },
    { label: "Activité", value: result.activite },
  ].filter((f) => f.value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg transition-all duration-200">
        <section className="premium-card rounded-[28px] border border-cyan-300/20 p-6 md:p-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-[var(--muted)] transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Entreprise trouvée</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Vérifiez les informations ci-dessous avant de continuer.
              </p>
            </div>
          </div>

          {result.raisonSociale && (
            <p className="mt-6 text-xl font-semibold text-white">{result.raisonSociale}</p>
          )}

          <div className="mt-4 grid gap-2">
            {fields.map((f) => (
              <div key={f.label} className="flex justify-between rounded-2xl bg-white/[0.035] px-4 py-3">
                <span className="text-sm text-[var(--muted)]">{f.label}</span>
                <span className="text-sm font-medium text-white">{f.value}</span>
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
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── Not found state ─── */
function NotFoundState({ query, onManual, onRetry }: { query: string; onManual: () => void; onRetry: () => void }) {
  return (
    <section className="premium-card rounded-[24px] p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--muted)] ring-1 ring-white/10">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-white">Entreprise introuvable</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Aucun résultat confirmé pour <span className="font-mono text-white">{query}</span>.
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
  const [showModal, setShowModal] = useState(false);

  async function handleSearch() {
    const parsed = parseCompanyLookupInput(query);
    if (!parsed.isValid) {
      setError(parsed.error ?? "Recherche invalide.");
      setResponse(null);
      setManualPayload(null);
      return;
    }

    const nextManualPayload = manualPayloadFromQuery(query);
    setManualPayload(nextManualPayload);
    setError(null);
    setResponse(null);
    setIsLoading(true);

    try {
      const apiResponse = await fetch("/api/company/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: parsed.normalizedValue }),
      });

      const data = (await apiResponse.json().catch(() => null)) as CompanyLookupResponse | null;

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
        setShowModal(true);
      }
    } catch {
      toast.error("La recherche automatique n’a pas pu aboutir.");
      setResponse({
        status: "unavailable",
        message:
          "La recherche automatique n’a pas pu aboutir. Vous pouvez continuer manuellement avec les informations dont vous disposez.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleManual() {
    const nextPayload = manualPayloadFromQuery(query);
    onManual(nextPayload ?? undefined);
  }

  const canSearch = query.trim().length > 0 && !isLoading;
  const externalUrl = buildMarocFactureIceSearchUrl(manualPayload?.query ?? query);
  const foundPayload =
    response?.status === "found" && response.result ? payloadFromResult(response.result) : null;
  const showFallback = response?.status === "unavailable" || response?.status === "blocked";

  return (
    <div className="space-y-6">
      {/* Search input card */}
      <section className="premium-card luxury-border rounded-[28px] p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6B56D]/12 text-[#D6B56D] ring-1 ring-[#D6B56D]/25">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Retrouvez votre entreprise
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Saisissez votre ICE ou votre raison sociale pour préremplir votre espace Felexia.
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              ICE ou raison sociale
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/70" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setError(null);
                  setResponse(null);
                  setManualPayload(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder="ICE ou raison sociale"
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.045] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[var(--muted-2)] focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"
              />
            </div>
            <button
              type="button"
              onClick={handleManual}
              className="mt-3 text-sm font-medium text-cyan-100/85 transition hover:text-cyan-100"
            >
              Créer manuellement
            </button>
            {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
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
      {showModal && response?.result && foundPayload && (
        <ResultModal
          result={response.result}
          onConfirm={() => {
            setShowModal(false);
            onConfirm(foundPayload);
          }}
          onModify={() => {
            setShowModal(false);
            onManual(foundPayload);
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Not found state */}
      {response?.status === "not_found" ? (
        <NotFoundState
          query={manualPayload?.query ?? query}
          onManual={handleManual}
          onRetry={() => void handleSearch()}
        />
      ) : null}

      {/* Fallback / unavailable / blocked state */}
      {showFallback ? (
        <section className="premium-card rounded-[24px] border border-[#D6B56D]/20 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D6B56D]/12 text-[#D6B56D] ring-1 ring-[#D6B56D]/20">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Recherche automatique indisponible
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                  {response.message}
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#E7D7AA]">
                  Cela ne signifie pas que l&apos;entreprise n&apos;existe pas.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => onManual(manualPayload ?? undefined)}>
                Continuer manuellement avec cette recherche
              </Button>
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              >
                Ouvrir la recherche externe
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
