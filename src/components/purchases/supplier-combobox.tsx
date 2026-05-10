"use client";

import { useState, useCallback } from "react";
import { Search } from "lucide-react";

type SupplierOption = { id: string; name: string; ice: string | null };

export function SupplierCombobox({
  suppliers,
  value,
  onChange,
}: {
  suppliers: SupplierOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = suppliers.find((s) => s.id === value);

  const filtered = suppliers.filter(
    (s) => s.name.toLowerCase().includes(query.toLowerCase()) || (s.ice ?? "").includes(query)
  );

  const select = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
      setQuery("");
    },
    [onChange]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span className={selected ? "text-slate-900" : "text-slate-400"}>
          {selected ? selected.name : "Selectionner un fournisseur..."}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl">
          <div className="sticky top-0 border-b border-slate-200 bg-white p-2">
            <input
              autoFocus
              placeholder="Rechercher..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Aucun fournisseur trouve.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => select(s.id)}
                  className={`w-full px-4 py-3 text-left text-sm transition hover:bg-indigo-50 hover:text-indigo-900 ${value === s.id ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-900"}`}
                >
                  <span className="block">{s.name}</span>
                  {s.ice ? <span className="mt-0.5 block text-xs text-slate-500">ICE: {s.ice}</span> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
