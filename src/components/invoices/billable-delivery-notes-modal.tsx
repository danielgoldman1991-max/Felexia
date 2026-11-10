"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
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
  const dialogId = useId();
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
    <FormDialog open={open} onDismiss={() => onOpenChange(false)} labelledBy={`${dialogId}-title`} describedBy={`${dialogId}-description`} className="max-w-5xl">
        <div className="erp-form-dialog__header flex items-start justify-between gap-4">
          <div>
            <h2 id={`${dialogId}-title`} className="text-lg font-semibold">Bons de livraison à facturer</h2>
            <p id={`${dialogId}-description`} className="mt-1 text-sm text-[var(--muted)]">
              Sélectionnez les bons de livraison valides à intégrer dans cette facture.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="erp-form-dialog__body overflow-auto">
          {deliveryNotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
              Aucun bon de livraison valide à facturer pour ce client.
            </div>
          ) : (
            <Table>
              <caption className="sr-only">Bons de livraison disponibles pour la facture ; les bons déjà facturés ne peuvent pas être sélectionnés.</caption>
              <thead>
                <tr>
                  <Th scope="col">Choix</Th>
                  <Th scope="col">BL</Th>
                  <Th scope="col">Date</Th>
                  <Th scope="col">Commande</Th>
                  <Th scope="col">Lignes</Th>
                  <Th scope="col">Quantité</Th>
                  <Th scope="col">Statut</Th>
                </tr>
              </thead>
              <tbody>
                {deliveryNotes.map((note) => {
                  const disabled = Boolean(note.already_invoiced);
                  const checked = draftIds.includes(note.id);
                  return (
                    <tr key={note.id} className={disabled ? "bg-slate-50 text-slate-400" : ""}>
                      <Td>
                        <label className="inline-flex min-h-11 min-w-11 items-center justify-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(note.id)}
                          className="h-5 w-5 rounded border-slate-300"
                          aria-label={`Sélectionner ${note.document_number}`}
                        />
                        </label>
                      </Td>
                      <Td className="font-medium">{note.document_number}</Td>
                      <Td>{formatDate(note.document_date)}</Td>
                      <Td>{note.related_order_number ?? "-"}</Td>
                      <Td>{note.lines_count ?? 0}</Td>
                      <Td>{formatNumber(note.total_quantity ?? 0)}</Td>
                      <Td>
                        {disabled ? <Badge tone="warning">Déjà facturé</Badge> : <Badge tone="success">{note.status}</Badge>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>

        <div className="erp-form-dialog__footer flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" onClick={confirm} disabled={draftIds.filter((id) => selectableIds.has(id)).length === 0}>
            Importer les BL sélectionnés
          </Button>
        </div>
    </FormDialog>
  );
}
