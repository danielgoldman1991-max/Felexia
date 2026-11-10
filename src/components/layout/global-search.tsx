"use client";

import type { ComponentType, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  FileText,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchStaticRegistry, type GlobalSearchCategory, type GlobalSearchResult } from "@/lib/global-search-registry";
import { cn } from "@/lib/utils";
import { isLaunchPathAvailable } from "@/lib/launch-profile";
import { isOperatorPathAllowed } from "@/lib/auth/operator-access";

const categoryIcons: Record<GlobalSearchCategory, ComponentType<{ className?: string }>> = {
  "Accès rapide": Sparkles,
  Tiers: Users,
  Articles: Package,
  Vente: FileText,
  Facturation: Receipt,
  Achats: ShoppingCart,
  Stock: ArrowLeftRight,
  Tresorerie: Banknote,
  RH: Users,
};

const categoryOrder: GlobalSearchCategory[] = ["Accès rapide", "Tiers", "Articles", "Vente", "Facturation", "Achats", "Stock", "Tresorerie", "RH"];

function groupedResults(results: GlobalSearchResult[]) {
  return categoryOrder
    .map((category) => ({ category, rows: results.filter((result) => result.category === category) }))
    .filter((group) => group.rows.length > 0);
}

export function GlobalSearch({ fullAccess = false, readOnly = false, operator = false }: { fullAccess?: boolean; readOnly?: boolean; operator?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dynamicResults, setDynamicResults] = useState<GlobalSearchResult[]>([]);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const staticResults = useMemo(
    () => searchStaticRegistry(query, 100).filter((result) => isLaunchPathAvailable(result.href, fullAccess) && (!readOnly || result.type !== "create") && (!operator || isOperatorPathAllowed(result.href))).slice(0, query.trim() ? 12 : 6),
    [query, fullAccess, readOnly, operator],
  );
  const results = useMemo(() => {
    if (query.trim().length < 2) return staticResults;
    const byId = new Map<string, GlobalSearchResult>();
    for (const result of [...dynamicResults, ...staticResults]) {
      if (isLaunchPathAvailable(result.href, fullAccess) && (!readOnly || result.type !== "create") && (!operator || isOperatorPathAllowed(result.href))) byId.set(result.id, result);
    }
    return [...byId.values()];
  }, [dynamicResults, fullAccess, query, readOnly, operator, staticResults]);
  const groups = groupedResults(results.slice(0, 30));
  const flatResults = groups.flatMap((group) => group.rows);
  const activeIndex = flatResults.findIndex((result) => result.id === activeResultId);
  const activeOptionId = activeIndex >= 0 ? `${searchId}-option-${activeIndex}` : undefined;

  function closeSearch() {
    inputRef.current?.focus();
    setOpen(false);
    setActiveResultId(null);
  }

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (document.querySelector("dialog[open], [aria-modal='true']")) return;
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open && activeOptionId) {
      document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeOptionId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveResultId(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/global-search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as { results?: GlobalSearchResult[]; error?: string };
          if (!response.ok || payload.error) throw new Error(payload.error || "Recherche indisponible.");
          return payload;
        })
        .then((payload) => {
          if (requestId === requestIdRef.current) setDynamicResults(payload.results ?? []);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setDynamicResults([]);
          setSearchError(error instanceof Error ? error.message : "Recherche indisponible.");
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false);
        });
    }, 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function openResult(result: GlobalSearchResult | undefined) {
    if (!result) return;
    setOpen(false);
    setQuery("");
    setActiveResultId(null);
    router.push(result.href);
  }

  function openAllResults() {
    const term = query.trim();
    if (term.length < 2) return;
    setOpen(false);
    setActiveResultId(null);
    router.push(`/recherche?q=${encodeURIComponent(term)}`);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveResultId(flatResults[Math.min(activeIndex + 1, flatResults.length - 1)]?.id ?? null);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveResultId(flatResults[activeIndex < 0 ? flatResults.length - 1 : Math.max(activeIndex - 1, 0)]?.id ?? null);
    }
    if (open && (event.key === "Home" || event.key === "End") && activeIndex >= 0) {
      event.preventDefault();
      setActiveResultId(flatResults[event.key === "Home" ? 0 : flatResults.length - 1]?.id ?? null);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && activeIndex >= 0) {
        openResult(flatResults[activeIndex]);
        return;
      }
      const term = query.trim();
      if (term.length >= 2) {
        openAllResults();
        return;
      }
      openResult(flatResults[0]);
    }
  }

  return (
    <div
      ref={containerRef}
      className="app-global-search relative min-w-0 max-w-[760px] flex-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActiveResultId(null);
        }
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeSearch();
        }
      }}
    >
      <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          setActiveResultId(null);
          setSearchError(null);
          setLoading(value.trim().length >= 2);
          if (value.trim().length < 2) setDynamicResults([]);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleInputKeyDown}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? `${searchId}-results` : undefined}
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-describedby={`${searchId}-hint`}
        aria-label="Recherche globale"
        autoComplete="off"
        spellCheck={false}
        className="app-search-input h-10 rounded-xl border-transparent bg-[var(--surface-soft)] pl-10 pr-3 text-sm sm:pr-20"
        placeholder="Rechercher…"
      />
      <kbd aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 font-sans text-[10px] font-medium text-[var(--muted)] sm:block">Ctrl K</kbd>
      <span id={`${searchId}-hint`} className="sr-only">Utilisez les flèches pour choisir un résultat, puis Entrée pour l’ouvrir. Échap ferme les suggestions. Ctrl ou Commande K ouvre la recherche.</span>

      {open ? (
        <div className="app-search-panel fixed left-4 right-4 top-20 z-[100] max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--popover)] p-2 shadow-[var(--shadow-lg)] sm:absolute sm:left-0 sm:right-0 sm:top-12">
          <div className="app-search-panel-header flex items-center justify-between gap-3 px-3 pb-2 pt-1">
            <p className="text-xs font-medium text-[var(--muted)]">{query.trim() ? "Résultats de recherche" : "Accès rapide"}</p>
            <button type="button" onClick={closeSearch} aria-label="Fermer les suggestions" className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]"><X aria-hidden="true" className="h-4 w-4" /></button>
          </div>
          {loading ? <p role="status" className="px-3 py-2 text-sm text-[var(--muted)]">Recherche en cours…</p> : null}
          {searchError ? <p role="alert" className="mx-2 mb-2 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{searchError} Réessayez dans un instant.</p> : null}
          {!loading && flatResults.length === 0 ? <p role="status" className="px-3 py-8 text-center text-sm text-[var(--muted)]">Aucun résultat trouvé.</p> : null}
          <div id={`${searchId}-results`} role="listbox" aria-label="Suggestions de recherche" aria-busy={loading}>
          {groups.map((group) => {
            const Icon = categoryIcons[group.category] ?? Building2;
            const groupId = `${searchId}-group-${categoryOrder.indexOf(group.category)}`;
            return (
              <div key={group.category} role="group" aria-labelledby={groupId} className="py-1">
                <div id={groupId} className="app-search-group-label flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  {group.category === "Tresorerie" ? "Trésorerie" : group.category}
                </div>
                <div className="space-y-1">
                  {group.rows.map((result) => {
                    const resultIndex = flatResults.findIndex((item) => item.id === result.id);
                    const active = result.id === activeResultId;
                    return (
                      <button
                        key={result.id}
                        id={`${searchId}-option-${resultIndex}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        tabIndex={-1}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => openResult(result)}
                        className={cn("app-search-result flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--ring)]", active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-soft)]")}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--muted-strong)]">
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <span className="app-search-result-copy min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--popover-foreground)]">{result.title}</span>
                          <span className="block truncate text-xs text-[var(--muted)]">{result.subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
          {query.trim().length >= 2 ? <div className="app-search-footer mt-2 border-t border-[var(--border-subtle)] pt-2"><button type="button" onClick={openAllResults} className="w-full rounded-lg px-3 py-3 text-left text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--ring)]">Voir tous les résultats</button></div> : null}
        </div>
      ) : null}
    </div>
  );
}
