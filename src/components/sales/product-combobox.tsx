"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProductOption = {
  id: string;
  type: "product" | "service" | string | null;
  sku?: string | null;
  name: string;
  description?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  unit_symbol?: string | null;
  sale_price_ht?: number | null;
  tax_rate_id?: string | null;
  tax_rate?: number | null;
  tax_rate_value?: number | null;
};

type ProductComboboxProps = {
  products: ProductOption[];
  value: string;
  onChange: (productId: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function productTypeLabel(type: string | null | undefined) {
  return type === "service" ? "Service" : "Produit";
}

function productMainLine(product: ProductOption) {
  return product.sku ? `${product.sku} - ${product.name}` : product.name;
}

function productSecondaryLine(product: ProductOption) {
  const description = product.description?.trim();

  return [
    productTypeLabel(product.type),
    formatMoney(product.sale_price_ht ?? 0),
    description ? description.slice(0, 80) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ProductCombobox({
  products,
  value,
  onChange,
  disabled = false,
  placeholder = "Rechercher un article ou service...",
}: ProductComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedProduct = products.find((product) => product.id === value) ?? null;

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalize(query);
    const source =
      normalizedQuery.length === 0
        ? products
        : products.filter((product) =>
            [product.name, product.sku, product.description, product.type]
              .filter(Boolean)
              .some((field) => normalize(field).includes(normalizedQuery)),
          );

    return source.slice(0, 20);
  }, [products, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectProduct(product: ProductOption) {
    if (disabled) return;

    onChange(product.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (!open && ["ArrowDown", "Enter"].includes(event.key)) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredProducts.length - 1, 0)));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const product = filteredProducts[activeIndex];
      if (product) selectProduct(product);
    }

    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const inputValue = open ? query : selectedProduct ? productMainLine(selectedProduct) : "";

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
            disabled ? "text-slate-400" : "text-[var(--muted)]",
          )}
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="product-combobox-listbox"
          aria-autocomplete="list"
          disabled={disabled}
          value={inputValue}
          placeholder={placeholder}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery("");
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-10 w-full rounded-[var(--radius-md)] border py-2 pl-9 pr-10 text-sm outline-none transition",
            disabled
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 placeholder:text-slate-400"
              : "border-[var(--border)] bg-white text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]",
          )}
        />
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2",
            disabled ? "text-slate-400" : "text-[var(--muted)]",
          )}
        />
      </div>

      {open && !disabled ? (
        <div
          id="product-combobox-listbox"
          role="listbox"
          className="absolute z-[100] mt-2 max-h-80 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="max-h-80 overflow-y-auto p-1.5">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product, index) => {
                const selected = product.id === value;
                const active = index === activeIndex;

                return (
                  <button
                    key={product.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectProduct(product)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
                      active ? "bg-indigo-50" : "hover:bg-indigo-50",
                    )}
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-indigo-600">
                      {selected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {productMainLine(product)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {productSecondaryLine(product)}
                      </span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-sm font-medium text-slate-900">
                Aucun article/service trouve
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
