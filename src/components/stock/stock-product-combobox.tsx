"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { StockProductOption } from "@/lib/stock-types";
import { cn } from "@/lib/utils";

type Props = {
  products: StockProductOption[];
  value?: string;
  onSelect?: (productId: string) => void;
  pushUrl?: boolean;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function productLabel(product: StockProductOption) {
  return product.sku ? `${product.sku} - ${product.name}` : product.name;
}

export function StockProductCombobox({ products, value, onSelect, pushUrl = true }: Props) {
  const router = useRouter();
  const selectedProduct = products.find((product) => product.id === value) ?? null;
  const [query, setQuery] = useState(selectedProduct ? productLabel(selectedProduct) : "");
  const [open, setOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    const needle = normalize(query);
    const source = needle
      ? products.filter((product) =>
          [product.name, product.sku, product.barcode]
            .some((item) => normalize(item).includes(needle)),
        )
      : products;

    return source.slice(0, 20);
  }, [products, query]);

  function selectProduct(product: StockProductOption) {
    setQuery(productLabel(product));
    setOpen(false);
    onSelect?.(product.id);
    if (pushUrl) {
      router.push(`/stock/mouvements?productId=${product.id}`);
    }
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher par nom, SKU ou code-barres..."
        role="combobox"
        aria-expanded={open}
      />
      {open ? (
        <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-[var(--shadow-md)]">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectProduct(product)}
                className={cn(
                  "block w-full border-b border-[var(--border)] px-3 py-2 text-left text-sm transition hover:bg-[var(--surface-soft)]",
                  product.id === value ? "bg-[var(--primary-soft)]" : "",
                )}
              >
                <span className="block font-medium text-[var(--foreground)]">{productLabel(product)}</span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  Stock actuel : {formatNumber(product.current_stock)} {product.unit_symbol ?? ""} · {product.track_stock ? "Suivi en stock" : "Non suivi"}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-sm text-[var(--muted)]">Aucun article trouve.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
