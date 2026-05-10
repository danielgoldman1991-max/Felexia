"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/format";
import type { BillableDeliveryOption } from "@/lib/invoice-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryNotes: BillableDeliveryOption[];
  selectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
};

export function BillableDeliveryNotesModal({
  open,
  onOpenChange,
  deliveryNotes,
  selectedIds,
  onConfirm,
}: Props) {
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const selectableIds = useMemo(
    () => new Set(deliveryNotes.filter((note) => !note.already_invoiced).map((note) => note.id)),
    [deliveryNotes],
  );

  if (!open) return null;

  function toggle(id: string) {
    if (!selectableIds.has(id)) return;
    setDraftIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function confirm() {
    onConfirm(draftIds.filter((id) => selectableIds.has(id)));
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Bons de livraison a facturer</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Selectionnez les bons de livraison valides a integrer dans cette facture.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[62vh] overflow-auto p-5">
          {deliveryNotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              Aucun bon de livraison valide a facturer pour ce client.
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Choix</Th>
                  <Th>BL</Th>
                  <Th>Date</Th>
                  <Th>Commande</Th>
                  <Th>Lignes</Th>
                  <Th>Quantite</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {deliveryNotes.map((note) => {
                  const disabled = Boolean(note.already_invoiced);
                  const checked = draftIds.includes(note.id);
                  return (
                    <tr key={note.id} className={disabled ? "bg-slate-50 text-slate-400" : ""}>
                      <Td>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(note.id)}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label={`Selectionner ${note.document_number}`}
                        />
                      </Td>
                      <Td className="font-medium">{note.document_number}</Td>
                      <Td>{formatDate(note.document_date)}</Td>
                      <Td>{note.related_order_number ?? "-"}</Td>
                      <Td>{note.lines_count ?? 0}</Td>
                      <Td>{formatNumber(note.total_quantity ?? 0)}</Td>
                      <Td>
                        {disabled ? <Badge tone="warning">Deja facture</Badge> : <Badge tone="success">{note.status}</Badge>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--border)] px-5 py-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" onClick={confirm} disabled={draftIds.filter((id) => selectableIds.has(id)).length === 0}>
            Importer les BL selectionnes
          </Button>
        </div>
      </div>
    </div>
  );
}
