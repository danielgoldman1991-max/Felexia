"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReconciliationAccountFilter({ accounts, selectedAccountId }: { accounts: { id: string; name: string }[]; selectedAccountId: string }) {
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
      className="flex max-w-md items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <label className="flex-1 space-y-2 text-sm">
        <span className="font-medium">Compte</span>
        <select name="accountId" defaultValue={selectedAccountId} className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? "Chargement…" : "Afficher"}</Button>
    </form>
  );
}
