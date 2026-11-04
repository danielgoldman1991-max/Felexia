"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { confirmAutomaticReconciliations, createTransactionFromStatementLine, ignoreStatementLine, reconcileStatementLineWithTransaction, unreconcileStatementLine } from "@/lib/treasury-actions";
import type { BankStatementLineRecord, ReconciliationSuggestion, TreasuryAccountRecord, TreasuryActionResult, TreasuryTransactionRecord } from "@/lib/treasury-types";
import { ReconciliationSuggestionBadge } from "@/components/treasury/reconciliation-suggestion-badge";

function reconcileAction(lineId: string, transactionId: string) {
  return (_prev: TreasuryActionResult) => {
    const formData = new FormData();
    formData.set("statement_line_id", lineId);
    formData.set("transaction_id", transactionId);
    return reconcileStatementLineWithTransaction(_prev, formData);
  };
}

function lineAction(action: typeof ignoreStatementLine, lineId: string) {
  return (_prev: TreasuryActionResult) => {
    const formData = new FormData();
    formData.set("statement_line_id", lineId);
    return action(_prev, formData);
  };
}

function ReconcileButton({ lineId, transactionId }: { lineId: string; transactionId: string }) {
  const [, formAction, pending] = useActionState(reconcileAction(lineId, transactionId), { success: true });
  return <form action={formAction}><PendingButton className="h-8" disabled={pending} idle="Rapprocher" pendingLabel="Rapprochement…" /></form>;
}

function LineButton({ label, lineId, action, variant = "secondary", confirm }: { label: string; lineId: string; action: typeof ignoreStatementLine; variant?: "secondary" | "ghost"; confirm?: string }) {
  const [state, formAction, pending] = useActionState(lineAction(action, lineId), { success: true });
  const toasted = useRef(false);
  useEffect(() => {
    if (pending) toasted.current = false;
    const message = (state.data as { message?: string } | undefined)?.message;
    if (!pending && state.success && message && !toasted.current) {
      toasted.current = true;
      toast.success(message);
    }
  }, [pending, state]);
  return (
    <form onSubmit={(event) => { event.preventDefault(); if (confirm && !window.confirm(confirm)) return; formAction(); }}>
      <Button type="submit" variant={variant} className="h-8" disabled={pending}>{pending ? "Patientez…" : label}</Button>
      {!state.success && state.error ? <span className="block text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

function CreateMovement({ lineId }: { lineId: string }) {
  const [state, action, pending] = useActionState(createTransactionFromStatementLine, { success: true });
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="statement_line_id" value={lineId} />
      <select name="category" defaultValue="bank_fee" aria-label="Catégorie du mouvement" className="h-8 rounded-md border border-[var(--border)] bg-[var(--card)] px-1 text-xs">
        <option value="bank_fee">Frais bancaires</option>
        <option value="vat">TVA</option>
        <option value="agio">Agios</option>
        <option value="commission">Commission</option>
        <option value="transfer">Virement</option>
        <option value="other">Autre</option>
      </select>
      <Button type="submit" variant="secondary" className="h-8" disabled={pending}>{pending ? "Création…" : "Créer mouvement"}</Button>
      {!state.success && state.error ? <span className="w-full text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

function AutomaticSuggestionsForm({ suggestions }: { suggestions: ReconciliationSuggestion[] }) {
  const [state, formAction, pending] = useActionState(confirmAutomaticReconciliations, { success: true });
  if (suggestions.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Aucune suggestion fiable trouvee pour ce compte.</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <Table>
        <thead><tr><Th>Selection</Th><Th>Ligne releve</Th><Th>Date releve</Th><Th>Montant</Th><Th>Mouvement interne</Th><Th>Date mouvement</Th><Th>Score</Th><Th>Raison</Th></tr></thead>
        <tbody>
          {suggestions.map((suggestion) => {
            const value = `${suggestion.statementLine.id}::${suggestion.transaction.id}::${suggestion.score}::${encodeURIComponent(suggestion.reason)}`;
            return (
              <tr key={`${suggestion.statementLine.id}-${suggestion.transaction.id}`}>
                <Td><input type="checkbox" name="suggestions" value={value} defaultChecked={suggestion.score >= 80} /></Td>
                <Td>{suggestion.statementLine.label}</Td>
                <Td>{suggestion.statementLine.operation_date}</Td>
                <Td><MoneyDisplay value={suggestion.statementLine.amount} /></Td>
                <Td>{suggestion.transaction.label}</Td>
                <Td>{suggestion.transaction.transaction_date}</Td>
                <Td><ReconciliationSuggestionBadge score={suggestion.score} /></Td>
                <Td>{suggestion.reason}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {!state.success && state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success && (state.data as { message?: string } | undefined)?.message ? <p className="text-sm text-emerald-700">{(state.data as { message: string }).message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" asChild><Link href="/tresorerie/rapprochement">Annuler</Link></Button>
        <PendingButton disabled={pending} idle="Confirmer les rapprochements sélectionnés" pendingLabel="Rapprochement…" />
      </div>
    </form>
  );
}

function AccountFilter({ accounts, selectedAccountId }: { accounts: TreasuryAccountRecord[]; selectedAccountId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const id = String(new FormData(event.currentTarget).get("accountId") ?? "");
        const params = new URLSearchParams();
        if (id) params.set("accountId", id);
        startTransition(() => {
          router.push(params.size ? `/tresorerie/rapprochement?${params}` : "/tresorerie/rapprochement");
        });
      }}
      className="flex max-w-md items-end gap-3"
    >
      <label className="flex-1 space-y-2 text-sm">
        <span className="font-medium">Compte bancaire</span>
        <Select name="accountId" defaultValue={selectedAccountId}>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </Select>
      </label>
      <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Chargement…" : "Afficher"}</Button>
    </form>
  );
}

export function ReconciliationWorkspace({
  accounts,
  selectedAccountId,
  statementLines,
  transactions,
  suggestions,
  reconciledLines = [],
  hideLegacyAuto = false,
}: {
  accounts: TreasuryAccountRecord[];
  selectedAccountId: string;
  statementLines: BankStatementLineRecord[];
  transactions: TreasuryTransactionRecord[];
  suggestions: ReconciliationSuggestion[];
  reconciledLines?: BankStatementLineRecord[];
  hideLegacyAuto?: boolean;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <AccountFilter accounts={accounts} selectedAccountId={selectedAccountId} />
        </CardContent>
      </Card>

      {hideLegacyAuto ? null : <Card>
        <CardHeader>
          <h2 className="font-semibold">Rapprochement automatique</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Voulez-vous lancer une proposition de rapprochement automatique basée sur les dates, montants, sens, compte et références ?</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] p-3"><span className="text-[var(--muted)]">Lignes bancaires</span><p className="text-xl font-semibold">{statementLines.length}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-3"><span className="text-[var(--muted)]">Mouvements internes</span><p className="text-xl font-semibold">{transactions.length}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-3"><span className="text-[var(--muted)]">Suggestions</span><p className="text-xl font-semibold">{suggestions.length}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" asChild><Link href={`/tresorerie/rapprochement?accountId=${selectedAccountId}&auto=1`}>Lancer le rapprochement automatique</Link></Button>
            <Button type="button" variant="secondary" asChild><Link href={`/tresorerie/rapprochement?accountId=${selectedAccountId}`}>Rapprocher manuellement</Link></Button>
          </div>
          {suggestions.length > 0 ? <AutomaticSuggestionsForm suggestions={suggestions} /> : null}
        </CardContent>
      </Card>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Lignes bancaires non rapprochées</h2></CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Date</Th><Th>Libellé</Th><Th>Sens</Th><Th>Montant</Th><Th>Suggestion</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {statementLines.map((line) => {
                  const suggestion = suggestions.find((item) => item.statementLine.id === line.id);
                  return (
                    <tr key={line.id}>
                      <Td>{line.operation_date}</Td>
                      <Td>{line.label}</Td>
                      <Td><Badge tone={line.direction === "in" ? "success" : "warning"}>{line.direction === "in" ? "Crédit" : "Débit"}</Badge></Td>
                      <Td><MoneyDisplay value={line.amount} /></Td>
                      <Td>{suggestion ? <ReconciliationSuggestionBadge score={suggestion.score} /> : "-"}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {suggestion?.transaction ? <ReconcileButton lineId={line.id} transactionId={suggestion.transaction.id} /> : null}
                          <CreateMovement lineId={line.id} />
                          <LineButton label="Ignorer" lineId={line.id} action={ignoreStatementLine} variant="ghost" />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h2 className="font-semibold">Mouvements internes non rapprochés</h2></CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Date</Th><Th>Libellé</Th><Th>Sens</Th><Th>Montant</Th><Th>Reference</Th></tr></thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <Td>{tx.transaction_date}</Td>
                    <Td>{tx.label}</Td>
                    <Td><Badge tone={tx.direction === "in" ? "success" : "warning"}>{tx.direction === "in" ? "Entrée" : "Sortie"}</Badge></Td>
                    <Td><MoneyDisplay value={tx.amount} /></Td>
                    <Td>{tx.reference ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">Lignes déjà rapprochées</h2></CardHeader>
        <CardContent>
          {reconciledLines.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucune ligne rapprochée sur ce compte.</p> : (
            <Table>
              <thead><tr><Th>Date</Th><Th>Libellé</Th><Th>Montant</Th><Th></Th></tr></thead>
              <tbody>
                {reconciledLines.map((line) => (
                  <tr key={line.id}>
                    <Td>{line.operation_date}</Td>
                    <Td>{line.label}</Td>
                    <Td><MoneyDisplay value={line.amount} /></Td>
                    <Td><LineButton label="Annuler le rapprochement" lineId={line.id} action={unreconcileStatementLine} variant="ghost" confirm="Annuler ce rapprochement ? Le règlement ou le mouvement créé sera extourné." /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
