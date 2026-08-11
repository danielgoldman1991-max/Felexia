"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, Td, Th } from "@/components/ui/table";
import { isIndivisibleUnit, normalizeIndivisibleQuantity } from "@/lib/sales-calculations";
import type { ReturnPreparationLine, SalesActionResult, SalesDocumentRecord } from "@/lib/sales-types";

type Props = {
  delivery: SalesDocumentRecord;
  lines: ReturnPreparationLine[];
  action: (state: SalesActionResult, formData: FormData) => Promise<SalesActionResult>;
};

const initialState: SalesActionResult = { success: true };

const returnReasons = [
  "Produit defectueux",
  "Erreur de livraison",
  "Produit non conforme",
  "Quantite incorrecte",
  "Client a change d'avis",
  "Emballage endommage",
  "Autre",
];

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ReturnNoteForm({ delivery, lines, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const returnableLines = useMemo(() => lines.filter((line) => line.returnable_quantity > 0), [lines]);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(returnableLines.map((line) => [line.id, 0])),
  );

  const payload = returnableLines
    .map((line) => ({
      source_line_id: line.id,
      quantity: quantities[line.id] ?? 0,
    }))
    .filter((line) => line.quantity > 0);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="delivery_id" value={delivery.id} />
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Bon de retour client</h2>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Motif de retour *</span>
            <Select name="return_reason" defaultValue="">
              <option value="">-- Selectionner --</option>
              {returnReasons.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </Select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-[var(--muted)]">Commentaire</span>
            <Textarea name="return_reason_details" rows={3} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Quantites a retourner</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Livre</Th>
                <Th>Deja retourne</Th>
                <Th>Retournable</Th>
                <Th>A retourner maintenant</Th>
              </tr>
            </thead>
            <tbody>
              {returnableLines.map((line) => {
                const indivisible = isIndivisibleUnit(line);

                return (
                  <tr key={line.id}>
                    <Td>
                      <p className="font-medium">{line.product_name || "Ligne libre"}</p>
                      <p className="text-xs text-[var(--muted)]">{line.description}</p>
                    </Td>
                    <Td>{line.quantity} {line.unit_name ?? ""}</Td>
                    <Td>{line.already_returned}</Td>
                    <Td>{line.returnable_quantity}</Td>
                    <Td>
                      <Input
                        type="number"
                        min="0"
                        max={line.returnable_quantity}
                        step={indivisible ? "1" : "0.001"}
                        value={quantities[line.id] ?? 0}
                        onChange={(event) => {
                          const nextQuantity = toNumber(event.target.value);
                          setQuantities((current) => ({
                            ...current,
                            [line.id]: Math.min(
                              indivisible ? normalizeIndivisibleQuantity(nextQuantity) : nextQuantity,
                              line.returnable_quantity,
                            ),
                          }));
                        }}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {!state.success && state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" asChild><Link href={`/vente/livraisons/${delivery.id}`}>Annuler</Link></Button>
        <Button disabled={pending || payload.length === 0}>Creer le bon de retour</Button>
      </div>
    </form>
  );
}
