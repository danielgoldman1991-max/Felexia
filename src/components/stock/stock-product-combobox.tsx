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
        <div className="absolute left-0 top-full z-[100] mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="max-h-80 overflow-y-auto">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectProduct(product)}
                  className={cn(
                    "w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-900 transition last:border-b-0 hover:bg-indigo-50 hover:text-indigo-900",
                    product.id === value ? "bg-indigo-50 font-medium text-indigo-700" : "",
                  )}
                >
                  <span className="block font-medium">{productLabel(product)}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Stock actuel : {formatNumber(product.current_stock)} {product.unit_symbol ?? ""} &middot; {product.track_stock ? "Suivi en stock" : "Non suivi"}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-slate-500">Aucun article trouve.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
