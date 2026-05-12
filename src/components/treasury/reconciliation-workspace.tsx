"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { confirmAutomaticReconciliations, createTransactionFromStatementLine, ignoreStatementLine, reconcileStatementLineWithTransaction } from "@/lib/treasury-actions";
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
  return <form action={formAction}><Button type="submit" className="h-8" disabled={pending}>Rapprocher</Button></form>;
}

function LineButton({ label, lineId, action, variant = "secondary" }: { label: string; lineId: string; action: typeof ignoreStatementLine; variant?: "secondary" | "ghost" }) {
  const [, formAction, pending] = useActionState(lineAction(action, lineId), { success: true });
  return <form action={formAction}><Button type="submit" variant={variant} className="h-8" disabled={pending}>{label}</Button></form>;
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
        <Link href="/tresorerie/rapprochement"><Button type="button" variant="secondary">Annuler</Button></Link>
        <Button disabled={pending}>Confirmer les rapprochements selectionnes</Button>
      </div>
    </form>
  );
}

export function ReconciliationWorkspace({
  accounts,
  selectedAccountId,
  statementLines,
  transactions,
  suggestions,
}: {
  accounts: TreasuryAccountRecord[];
  selectedAccountId: string;
  statementLines: BankStatementLineRecord[];
  transactions: TreasuryTransactionRecord[];
  suggestions: ReconciliationSuggestion[];
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <form method="get" className="flex max-w-md items-end gap-3">
            <label className="flex-1 space-y-2 text-sm">
              <span className="font-medium">Compte bancaire</span>
              <Select name="accountId" defaultValue={selectedAccountId}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </Select>
            </label>
            <Button type="submit">Afficher</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Rapprochement automatique</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Voulez-vous lancer une proposition de rapprochement automatique basee sur les dates, montants, sens, compte et references ?</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-[var(--border)] p-3"><span className="text-[var(--muted)]">Lignes bancaires</span><p className="text-xl font-semibold">{statementLines.length}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-3"><span className="text-[var(--muted)]">Mouvements internes</span><p className="text-xl font-semibold">{transactions.length}</p></div>
            <div className="rounded-lg border border-[var(--border)] p-3"><span className="text-[var(--muted)]">Suggestions</span><p className="text-xl font-semibold">{suggestions.length}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/tresorerie/rapprochement?accountId=${selectedAccountId}&auto=1`}><Button type="button">Lancer le rapprochement automatique</Button></Link>
            <Link href={`/tresorerie/rapprochement?accountId=${selectedAccountId}`}><Button type="button" variant="secondary">Rapprocher manuellement</Button></Link>
          </div>
          {suggestions.length > 0 ? <AutomaticSuggestionsForm suggestions={suggestions} /> : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-semibold">Lignes bancaires non rapprochees</h2></CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Date</Th><Th>Libelle</Th><Th>Sens</Th><Th>Montant</Th><Th>Suggestion</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {statementLines.map((line) => {
                  const suggestion = suggestions.find((item) => item.statementLine.id === line.id);
                  return (
                    <tr key={line.id}>
                      <Td>{line.operation_date}</Td>
                      <Td>{line.label}</Td>
                      <Td><Badge tone={line.direction === "in" ? "success" : "warning"}>{line.direction === "in" ? "Credit" : "Debit"}</Badge></Td>
                      <Td><MoneyDisplay value={line.amount} /></Td>
                      <Td>{suggestion ? <ReconciliationSuggestionBadge score={suggestion.score} /> : "-"}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {suggestion?.transaction ? <ReconcileButton lineId={line.id} transactionId={suggestion.transaction.id} /> : null}
                          <LineButton label="Creer mouvement" lineId={line.id} action={createTransactionFromStatementLine} />
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
          <CardHeader><h2 className="font-semibold">Mouvements internes non rapproches</h2></CardHeader>
          <CardContent>
            <Table>
              <thead><tr><Th>Date</Th><Th>Libelle</Th><Th>Sens</Th><Th>Montant</Th><Th>Reference</Th></tr></thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <Td>{tx.transaction_date}</Td>
                    <Td>{tx.label}</Td>
                    <Td><Badge tone={tx.direction === "in" ? "success" : "warning"}>{tx.direction === "in" ? "Entree" : "Sortie"}</Badge></Td>
                    <Td><MoneyDisplay value={tx.amount} /></Td>
                    <Td>{tx.reference ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
