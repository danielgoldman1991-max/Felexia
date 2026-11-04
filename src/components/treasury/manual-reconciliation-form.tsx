"use client";

import { useActionState } from "react";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveManualMatch, undoManualMatch } from "@/lib/treasury/reconciliation-actions";
import type { ManualMatchBoard } from "@/lib/treasury/manual-match-data";
import type { TreasuryActionResult } from "@/lib/treasury-types";

const initial = { success: true } as TreasuryActionResult;

export function ManualReconciliationForm({ board }: { board: ManualMatchBoard }) {
  const [state, action, pending] = useActionState(saveManualMatch, initial);
  const message = (state.data as { message?: string } | undefined)?.message;
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Rapprochement manuel</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Cochez une ou plusieurs lignes et une ou plusieurs pièces. Un montant inférieur au reste laisse la différence ouverte. Le total des lignes doit égaler le total des pièces. Ce lien n&apos;enregistre pas de règlement.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {board.pendingMigration ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Le rapprochement manuel sera enregistré après la migration 141.</p> : null}
        <form action={action} className="space-y-4">
          <input type="hidden" name="account_id" value={board.accountId} />
          <MatchTable title="Lignes du relevé" empty="Aucune ligne ouverte." rows={board.lines.map((line) => ({
            key: line.id,
            name: "line_id",
            value: line.id,
            amountName: `line_amount_${line.id}`,
            title: line.label,
            detail: `${line.date} · ${line.direction === "out" ? "Sortie" : "Entrée"}`,
            remaining: line.remaining,
          }))} />
          <MatchTable title="Pièces ouvertes" empty="Aucune facture ni mouvement ouvert." rows={board.documents.map((document) => ({
            key: `${document.kind}:${document.id}`,
            name: "document_id",
            value: `${document.kind}:${document.id}`,
            amountName: `document_amount_${document.kind}_${document.id}`,
            title: document.label,
            detail: `${document.party || "Sans tiers"} · ${document.date} · ${document.kind === "transaction" ? "Mouvement" : document.kind === "customer_invoice" ? "Facture client" : "Facture fournisseur"}`,
            remaining: document.remaining,
          }))} />
          <Button type="submit" disabled={pending || board.pendingMigration || !board.accountId} aria-busy={pending}>{pending ? "Rapprochement…" : "Rapprocher la sélection"}</Button>
          {state.success && message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {!state.success && state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        </form>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Rapprochements manuels à annuler</h3>
          {board.matches.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucun rapprochement manuel confirmé.</p> : board.matches.map((match) => <UndoRow key={match.id} match={match} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function MatchTable({ title, empty, rows }: { title: string; empty: string; rows: { key: string; name: string; value: string; amountName: string; title: string; detail: string; remaining: number }[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-[var(--muted)]">{empty}</p> : (
        <div className="space-y-2">
          {rows.map((row) => (
            <label key={row.key} className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 sm:grid-cols-[auto_1fr_9rem] sm:items-center">
              <input type="checkbox" name={row.name} value={row.value} />
              <span>
                <span className="block font-medium">{row.title}</span>
                <span className="block text-xs text-[var(--muted)]">{row.detail} · reste <MoneyDisplay value={row.remaining} /></span>
              </span>
              <Input name={row.amountName} inputMode="decimal" defaultValue={row.remaining.toFixed(2)} aria-label={`Montant pour ${row.title}`} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function UndoRow({ match }: { match: ManualMatchBoard["matches"][number] }) {
  const [state, action, pending] = useActionState(undoManualMatch, initial);
  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2">
      <input type="hidden" name="match_id" value={match.id} />
      <span className="text-sm">{match.kind === "grouped" ? "Groupé" : "Partiel"}{match.partial ? " · incomplet" : ""} · {match.summary} · <MoneyDisplay value={match.total} /></span>
      <Button type="submit" variant="secondary" className="h-8" disabled={pending}>{pending ? "Annulation…" : "Annuler"}</Button>
      {!state.success && state.error ? <span className="w-full text-xs text-red-700">{state.error}</span> : null}
      {state.success && (state.data as { message?: string } | undefined)?.message ? <span className="w-full text-xs text-emerald-700">{(state.data as { message: string }).message}</span> : null}
    </form>
  );
}
