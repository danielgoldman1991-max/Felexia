"use client";

import type { ComponentType, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { searchStaticRegistry, type GlobalSearchCategory, type GlobalSearchResult } from "@/lib/global-search-registry";
import { cn } from "@/lib/utils";

const categoryIcons: Record<GlobalSearchCategory, ComponentType<{ className?: string }>> = {
  "Acces rapide": Sparkles,
  Tiers: Users,
  Articles: Package,
  Vente: FileText,
  Facturation: Receipt,
  Achats: ShoppingCart,
  Stock: ArrowLeftRight,
  Tresorerie: Banknote,
};

const categoryOrder: GlobalSearchCategory[] = ["Acces rapide", "Tiers", "Articles", "Vente", "Facturation", "Achats", "Stock", "Tresorerie"];

function groupedResults(results: GlobalSearchResult[]) {
  return categoryOrder
    .map((category) => ({ category, rows: results.filter((result) => result.category === category) }))
    .filter((group) => group.rows.length > 0);
}

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dynamicResults, setDynamicResults] = useState<GlobalSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const staticResults = useMemo(() => searchStaticRegistry(query, query.trim() ? 12 : 6), [query]);
  const results = useMemo(() => {
    if (query.trim().length < 2) return staticResults;
    const byId = new Map<string, GlobalSearchResult>();
    for (const result of [...dynamicResults, ...staticResults]) byId.set(result.id, result);
    return [...byId.values()];
  }, [dynamicResults, query, staticResults]);
  const flatResults = results.slice(0, 30);
  const groups = groupedResults(flatResults);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
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
    router.push(result.href);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(flatResults.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openResult(flatResults[activeIndex] ?? flatResults[0]);
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setActiveIndex(0);
          setSearchError(null);
          setLoading(value.trim().length >= 2);
          if (value.trim().length < 2) setDynamicResults([]);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleInputKeyDown}
        className="h-11 rounded-2xl pl-10 pr-20 text-sm"
        placeholder="Rechercher une fonction, un client, un document..."
      />
      <span className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)] sm:block">Ctrl K</span>

      {open ? (
        <div className="absolute left-0 right-0 top-14 z-[100] max-h-[70vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--popover)] p-2 shadow-[var(--shadow-lg)]">
          {loading ? <p className="px-3 py-2 text-sm text-[var(--muted)]">Recherche...</p> : null}
          {searchError ? <p className="mx-2 mb-2 rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{searchError} Réessayez dans un instant.</p> : null}
          {!loading && flatResults.length === 0 ? <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">Aucun resultat trouve.</p> : null}
          {groups.map((group) => {
            const Icon = categoryIcons[group.category] ?? Building2;
            return (
              <div key={group.category} className="py-1">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  <Icon className="h-3.5 w-3.5" />
                  {group.category}
                </div>
                <div className="space-y-1">
                  {group.rows.map((result) => {
                    const active = flatResults.findIndex((item) => item.id === result.id) === activeIndex;
                    return (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => openResult(result)}
                        className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition", active ? "bg-[var(--surface-soft)]" : "hover:bg-[var(--surface-soft)]/70")}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--info-soft)] text-[var(--info)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--popover-foreground)]">{result.title}</span>
                          <span className="block truncate text-xs text-[var(--muted)]">{result.subtitle}</span>
                        </span>
                        <Badge tone={result.type === "create" ? "info" : "neutral"}>{result.category}</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
