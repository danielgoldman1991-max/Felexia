"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Archive, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/empty-state";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { archiveProduct } from "@/lib/product-actions";
import type { ProductRecord } from "@/lib/product-types";
import { formatDate } from "@/lib/format";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">{label}</p>
      <div className="mt-1 text-sm">{value ?? "-"}</div>
    </div>
  );
}

export function ProductDetail({ product }: { product: ProductRecord }) {
  const [archiveState, archiveAction] = useActionState(archiveProduct, { success: true });
  const isService = product.type === "service";
  const lowStock = product.track_stock && product.current_stock <= product.min_stock;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal text-[var(--foreground)]">{product.name}</h1>
              {product.sku ? <span className="font-mono text-sm text-[var(--muted)]">({product.sku})</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isService ? "info" : "success"}>{isService ? "Service" : "Produit"}</Badge>
              <StatusBadge status={product.status} />
              <span className="text-sm text-[var(--muted)]">Cree le {formatDate(product.created_at)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/articles/${product.id}/edit`}>
              <Button variant="secondary"><Pencil className="h-4 w-4" /> Modifier</Button>
            </Link>
            {product.status !== "archived" ? (
              <form action={archiveAction}>
                <input type="hidden" name="id" value={product.id} />
                <Button variant="danger"><Archive className="h-4 w-4" /> Archiver</Button>
                {!archiveState.success && archiveState.error ? (
                  <p className="mt-1 text-xs text-red-600">{archiveState.error}</p>
                ) : null}
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Informations generales</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Type" value={isService ? "Service" : "Produit"} />
            <Info label="Reference interne" value={product.sku} />
            <Info label="Code-barres" value={product.barcode} />
            <Info label="Categorie" value={product.category_name} />
            <Info label="Unite" value={product.unit_name ? `${product.unit_name} (${product.unit_symbol ?? ""})` : null} />
            <div className="md:col-span-2">
              <Info label="Description" value={product.description} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">Prix & TVA</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Prix d'achat HT" value={<MoneyDisplay value={product.purchase_price_ht} />} />
            <Info label="Prix de vente HT" value={<MoneyDisplay value={product.sale_price_ht} />} />
            <Info label="TVA" value={product.tax_rate_name ? `${product.tax_rate_name} (${product.tax_rate_value ?? 0}%)` : null} />
            <Info label="Prix vente TTC" value={<MoneyDisplay value={product.sale_price_ttc} />} />
            <Info label="Marge estimee" value={<MoneyDisplay value={product.margin_amount} />} />
            <Info label="Taux de marge" value={product.margin_rate ? `${product.margin_rate.toFixed(1)}%` : null} />
          </CardContent>
        </Card>
      </div>

      {isService ? (
        <Card>
          <CardContent className="py-4 text-sm text-[var(--muted)]">
            Le stock n&apos;est pas applicable aux services.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><h2 className="font-semibold">Stock</h2></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <Info label="Suivi de stock" value={product.track_stock ? "Oui" : "Non"} />
            <Info label="Stock actuel" value={
              <span className={lowStock ? "font-semibold text-[var(--danger)]" : ""}>
                {product.current_stock} {product.unit_symbol ?? ""}
              </span>
            } />
            <Info label="Stock minimum" value={product.min_stock} />
            <Info label="Alerte stock bas" value={product.stock_alert_enabled ? "Oui" : "Non"} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><h2 className="font-semibold">Options commerciales</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Info label="Vendable" value={product.is_sellable ? "Oui" : "Non"} />
          <Info label="Achetable" value={product.is_purchasable ? "Oui" : "Non"} />
          <Info label="Remise par defaut" value={product.default_discount_rate ? `${product.default_discount_rate}%` : null} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Notes internes</h2></CardHeader>
          <CardContent>
            {product.notes ? (
              <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{product.notes}</p>
            ) : (
              <EmptyState title="Aucune note" description="Aucune note interne renseignee pour cet article." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="font-semibold">Activite recente</h2></CardHeader>
          <CardContent>
            <EmptyState title="Activite a venir" description="L'activite article sera disponible dans une prochaine etape." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
