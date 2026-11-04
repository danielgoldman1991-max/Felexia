"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { postPendingAccountingDocuments, type PendingAccountingDocument } from "@/lib/accounting-actions";
import type { AccountingActionResult } from "@/lib/accounting-types";

export function PendingPostPanel({ documents }: { documents: PendingAccountingDocument[] }) {
  const [state, action, pending] = useActionState(postPendingAccountingDocuments, { success: true } as AccountingActionResult);
  const message = (state.data as { message?: string } | undefined)?.message;
  if (documents.length === 0 && !message) return null;
  return (
    <form action={action} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Pièces en attente de comptabilisation</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{documents.length} pièce{documents.length > 1 ? "s" : ""} validée{documents.length > 1 ? "s" : ""} sans écriture.</p>
        </div>
        <Button type="submit" disabled={pending || documents.length === 0}>{pending ? "Comptabilisation…" : "Comptabiliser les pièces en attente"}</Button>
      </div>
      {documents.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {documents.slice(0, 12).map((document) => <li key={`${document.kind}:${document.id}`}>{document.label} {document.number}</li>)}
        </ul>
      ) : null}
      {!state.success && state.error ? <p className="mt-3 text-sm text-red-700">{state.error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
    </form>
  );
}
