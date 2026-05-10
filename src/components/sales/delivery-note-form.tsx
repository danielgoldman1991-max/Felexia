"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { isIndivisibleUnit } from "@/lib/sales-calculations";
import { formatNumber } from "@/lib/format";
import type { DeliveryPreparationLine, SalesActionResult, SalesDocumentRecord } from "@/lib/sales-types";

type Props = {
  order: SalesDocumentRecord;
  lines: DeliveryPreparationLine[];
  action: (state: SalesActionResult, formData: FormData) => Promise<SalesActionResult>;
};

const initialState: SalesActionResult = { success: true };

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function normalizeDeliveryQuantity(quantity: number, indivisible: boolean) {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;

  return indivisible ? Math.floor(parsed) : parsed;
}

export function DeliveryNoteForm({ order, lines, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const deliverableLines = useMemo(() => lines.filter((line) => line.remaining_to_deliver > 0), [lines]);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(deliverableLines.map((line) => [line.id, line.remaining_to_deliver])),
  );

  const payload = useMemo(
    () =>
      deliverableLines
        .map((line) => ({
          source_line_id: line.id,
          quantity: quantities[line.id] ?? 0,
        }))
        .filter((line) => line.quantity > 0),
    [deliverableLines, quantities],
  );

  const validationError = useMemo(() => {
    if (payload.length === 0) return "Selectionnez au moins une quantite a livrer.";

    for (const line of deliverableLines) {
      const quantity = quantities[line.id] ?? 0;
      if (quantity < 0) return "Une quantite a livrer ne peut pas etre negative.";
      if (quantity > line.remaining_to_deliver) return "Une quantite a livrer depasse le reliquat disponible.";
      if (isIndivisibleUnit(line) && !Number.isInteger(quantity)) {
        return "La quantite doit etre entiere pour les lignes en unite U.";
      }
    }

    return null;
  }, [deliverableLines, payload.length, quantities]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="order_id" value={order.id} />
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Preparation livraison</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><span className="font-medium">Commande :</span> {order.document_number}</p>
          <p><span className="font-medium">Client :</span> {order.customer_name ?? "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Informations BL</h2>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Date du BL</span>
            <Input type="date" name="document_date" defaultValue={today()} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--foreground)]">Adresse de livraison</span>
            <Input name="delivery_address" placeholder="Adresse de livraison si differente" />
          </label>
          <label className="space-y-2 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--foreground)]">Notes livraison</span>
            <Input name="notes" placeholder="Instructions visibles sur le bon de livraison" />
          </label>
          <label className="space-y-2 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--foreground)]">Notes internes</span>
            <Input name="internal_notes" placeholder="Notes internes non imprimees" />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Lignes a livrer</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Article / Service</Th>
                <Th>Description</Th>
                <Th>Commande</Th>
                <Th>Deja livre</Th>
                <Th>Reste</Th>
                <Th>A livrer maintenant</Th>
                <Th>Stock disponible</Th>
                <Th>Alerte</Th>
              </tr>
            </thead>
            <tbody>
              {deliverableLines.length > 0 ? deliverableLines.map((line, index) => {
                const indivisible = isIndivisibleUnit(line);
                const quantity = quantities[line.id] ?? 0;
                const hasStockWarning = line.is_stockable && line.current_stock !== null && quantity > line.current_stock;

                return (
                  <tr key={line.id}>
                    <Td>{index + 1}</Td>
                    <Td>
                      <p className="font-medium">{line.product_name || "Ligne libre"}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {line.product_type === "service" ? "Service" : line.is_stockable ? "Produit stockable" : "Non stockable"}
                      </p>
                    </Td>
                    <Td>
                      <p className="text-sm">{line.description}</p>
                    </Td>
                    <Td>{formatNumber(line.quantity)} {line.unit_name ?? ""}</Td>
                    <Td>{formatNumber(line.already_delivered)}</Td>
                    <Td className="font-semibold text-[var(--secondary)]">{formatNumber(line.remaining_to_deliver)}</Td>
                    <Td>
                      <Input
                        type="number"
                        min="0"
                        max={line.remaining_to_deliver}
                        step={indivisible ? "1" : "0.001"}
                        value={quantity}
                        onChange={(event) => {
                          const nextQuantity = toNumber(event.target.value);
                          setQuantities((current) => ({
                            ...current,
                            [line.id]: Math.min(
                              normalizeDeliveryQuantity(nextQuantity, indivisible),
                              line.remaining_to_deliver,
                            ),
                          }));
                        }}
                      />
                      {indivisible ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">Unite indivisible : entier uniquement.</p>
                      ) : null}
                    </Td>
                    <Td>
                      {line.is_stockable ? formatNumber(line.current_stock ?? 0) : "Non impacte"}
                    </Td>
                    <Td>
                      {hasStockWarning ? (
                        <span className="text-xs font-semibold text-[var(--danger)]">Stock insuffisant</span>
                      ) : line.is_stockable ? (
                        <span className="text-xs text-[var(--success)]">OK</span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">Aucun mouvement</span>
                      )}
                    </Td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9} className="border-t border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                    Cette commande ne contient plus de lignes a livrer.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {validationError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{validationError}</p>
      ) : null}

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Link href={`/vente/commandes/${order.id}`}>
          <Button type="button" variant="secondary">Annuler</Button>
        </Link>
        <Button disabled={pending || Boolean(validationError)}>Creer le BL</Button>
      </div>
    </form>
  );
}
