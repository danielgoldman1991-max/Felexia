"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import type { PurchaseProductOption } from "@/lib/purchase-types";

export function PurchaseProductCombobox({
  products,
  onSelect,
}: {
  products: PurchaseProductOption[];
  onSelect: (product: PurchaseProductOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const select = useCallback(
    (product: PurchaseProductOption) => {
      onSelect(product);
      setOpen(false);
      setQuery("");
    },
    [onSelect]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 text-left focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span>Ajouter un article...</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl">
          <div className="sticky top-0 border-b border-slate-200 bg-white p-2">
            <input
              autoFocus
              placeholder="Rechercher un article..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Aucun article trouve.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => select(p)}
                  className="w-full px-4 py-3 text-left text-sm text-slate-900 transition hover:bg-indigo-50 hover:text-indigo-900"
                >
                  <span className="font-medium">{p.name}</span>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    {p.sku ? <span>({p.sku})</span> : null}
                    <span>{p.purchase_price_ht.toFixed(2)} MAD</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
