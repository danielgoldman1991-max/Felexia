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

  const staticResults = useMemo(() => searchStaticRegistry(query, query.trim() ? 12 : 6), [query]);
  const results = query.trim().length >= 2 ? dynamicResults : staticResults;
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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/global-search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.json() as Promise<{ results?: GlobalSearchResult[] }>)
        .then((payload) => setDynamicResults(payload.results ?? []))
        .catch(() => setDynamicResults([]))
        .finally(() => setLoading(false));
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
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setActiveIndex(0);
          if (value.trim().length < 2) setDynamicResults([]);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleInputKeyDown}
        className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10 pr-20 text-sm shadow-none"
        placeholder="Rechercher une fonction, un client, un document..."
      />
      <span className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-400 sm:block">Ctrl K</span>

      {open ? (
        <div className="absolute left-0 right-0 top-14 z-[100] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {loading ? <p className="px-3 py-2 text-sm text-slate-500">Recherche...</p> : null}
          {!loading && flatResults.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Aucun resultat trouve.</p> : null}
          {groups.map((group) => {
            const Icon = categoryIcons[group.category] ?? Building2;
            return (
              <div key={group.category} className="py-1">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                        className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition", active ? "bg-blue-50" : "hover:bg-slate-50")}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-950">{result.title}</span>
                          <span className="block truncate text-xs text-slate-500">{result.subtitle}</span>
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
