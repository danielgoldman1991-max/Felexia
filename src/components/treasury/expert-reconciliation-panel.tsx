"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MoneyDisplay } from "@/components/erp/money-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { confirmExpertAuto, confirmExpertLine, saveReconciliationSettings } from "@/lib/treasury/reconciliation-actions";
import type { ExpertLineView, ExpertReconciliationView } from "@/lib/treasury/reconciliation-types";
import type { TreasuryActionResult } from "@/lib/treasury-types";

const bandLabel = { auto: "Automatique", suggestion: "À valider", todo: "À traiter" } as const;

function LineConfirm({ line, accountId }: { line: ExpertLineView; accountId: string }) {
  const [state, action, pending] = useActionState(confirmExpertLine, { success: true } as TreasuryActionResult);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="account_id" value={accountId} />
      <input type="hidden" name="statement_line_id" value={line.lineId} />
      <PendingButton className="h-8" disabled={pending} idle="Valider" pendingLabel="Validation…" />
      {!state.success && state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

function Lines({ title, rows, accountId, confirm }: { title: string; rows: ExpertLineView[]; accountId: string; confirm: boolean }) {
  return (
    <Card>
      <CardHeader><h2 className="font-semibold">{title}</h2></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucune ligne dans ce groupe.</p> : (
          <Table>
            <thead>
              <tr><Th>Date</Th><Th>Libellé</Th><Th>Montant</Th><Th>Score</Th><Th>Proposition</Th>{confirm ? <Th></Th> : null}</tr>
            </thead>
            <tbody>
              {rows.map((line) => (
                <tr key={line.lineId}>
                  <Td>{line.date}</Td>
                  <Td>
                    <span className="block max-w-xs truncate font-medium">{line.label}</span>
                    <span className="block text-xs text-[var(--muted)]">{line.reason}</span>
                  </Td>
                  <Td><MoneyDisplay value={line.direction === "out" ? -line.amount : line.amount} /></Td>
                  <Td><Badge tone={line.band === "auto" ? "success" : line.band === "suggestion" ? "warning" : "neutral"}>{line.score || "—"}</Badge></Td>
                  <Td>{line.summary || bandLabel[line.band]}</Td>
                  {confirm ? <Td><LineConfirm line={line} accountId={accountId} /></Td> : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function ExpertReconciliationPanel({ view }: { view: ExpertReconciliationView }) {
  const [autoState, autoAction, autoPending] = useActionState(confirmExpertAuto, { success: true } as TreasuryActionResult);
  const [settingsState, settingsAction, settingsPending] = useActionState(saveReconciliationSettings, { success: true } as TreasuryActionResult);
  const auto = view.lines.filter((line) => line.band === "auto");
  const suggestions = view.lines.filter((line) => line.band === "suggestion");
  const todo = view.lines.filter((line) => line.band === "todo");
  return (
    <div className="space-y-5">
      {view.pending ? <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Le moteur fonctionne. Les règles et le journal seront enregistrés après la migration 126.</p> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent><p className="text-xs text-[var(--muted)]">Solde du relevé</p><p className="mt-1 text-xl font-semibold tabular-nums">{view.balances.statement === null ? "—" : <MoneyDisplay value={view.balances.statement} />}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-[var(--muted)]">Solde comptable</p><p className="mt-1 text-xl font-semibold tabular-nums">{view.balances.book === null ? "—" : <MoneyDisplay value={view.balances.book} />}</p></CardContent></Card>
        <Card><CardContent><p className="text-xs text-[var(--muted)]">Écart</p><p className="mt-1 text-xl font-semibold tabular-nums">{view.balances.gap === null ? "—" : <MoneyDisplay value={view.balances.gap} />}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Rapprochement automatique</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{view.counts.auto} ligne{view.counts.auto > 1 ? "s" : ""} au-dessus du seuil, {view.counts.suggestion} à valider, {view.counts.todo} à traiter. Annuler rouvre la ligne et extourne le règlement créé par ce rapprochement.</p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={autoAction}>
            <input type="hidden" name="account_id" value={view.accountId} />
            <PendingButton disabled={autoPending || !view.settings.autoEnabled || view.counts.auto === 0} idle="Rapprocher les scores élevés" pendingLabel="Rapprochement…" />
          </form>
          <Button variant="secondary" asChild><Link href={`/tresorerie/rapprochement/etat?accountId=${view.accountId}`}>État PDF</Link></Button>
          <Button variant="secondary" asChild><Link href={`/tresorerie/rapprochement/export?accountId=${view.accountId}`}>Excel</Link></Button>
          <Button variant="ghost" asChild><Link href="/tresorerie/rapprochement/regles">Règles</Link></Button>
          {autoState.success && (autoState.data as { message?: string } | undefined)?.message ? <p className="w-full text-sm text-emerald-700">{(autoState.data as { message: string }).message}</p> : null}
          {!autoState.success && autoState.error ? <p className="w-full text-sm text-red-700">{autoState.error}</p> : null}
        </CardContent>
      </Card>
      <Lines title="À rapprocher automatiquement" rows={auto} accountId={view.accountId} confirm />
      <Lines title="Suggestions à valider" rows={suggestions} accountId={view.accountId} confirm />
      <Lines title="À traiter" rows={todo} accountId={view.accountId} confirm={false} />
      <Card>
        <CardHeader><h2 className="font-semibold">Seuils</h2></CardHeader>
        <CardContent>
          <form action={settingsAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Score automatique<Input name="auto_threshold" type="number" min="80" max="100" defaultValue={view.settings.autoThreshold} className="mt-1" /></label>
            <label className="text-sm">Score suggestion<Input name="suggest_threshold" type="number" min="40" max="90" defaultValue={view.settings.suggestThreshold} className="mt-1" /></label>
            <label className="text-sm">Fenêtre de date (jours)<Input name="date_window_days" type="number" min="0" max="15" defaultValue={view.settings.dateWindowDays} className="mt-1" /></label>
            <label className="flex items-end gap-2 text-sm"><input type="checkbox" name="auto_enabled" defaultChecked={view.settings.autoEnabled} /> Autoriser le lot automatique</label>
            <div className="sm:col-span-2 lg:col-span-4"><PendingButton variant="secondary" disabled={settingsPending} idle="Enregistrer les seuils" pendingLabel="Enregistrement…" /></div>
            {!settingsState.success && settingsState.error ? <p className="text-sm text-red-700 sm:col-span-2">{settingsState.error}</p> : null}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Journal</h2></CardHeader>
        <CardContent>
          {view.events.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucune validation enregistrée.</p> : (
            <Table>
              <thead><tr><Th>Date</Th><Th>Action</Th><Th>Score</Th><Th>Motif</Th></tr></thead>
              <tbody>
                {view.events.map((event) => (
                  <tr key={event.id}><Td>{event.createdAt.slice(0, 16).replace("T", " ")}</Td><Td>{event.action}</Td><Td>{event.score ?? "—"}</Td><Td>{event.reason ?? "—"}</Td></tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
