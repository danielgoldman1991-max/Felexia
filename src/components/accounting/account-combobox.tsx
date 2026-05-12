"use client";

import { useMemo, useState } from "react";
import type { ChartOfAccountOption } from "@/lib/accounting-types";

export function AccountCombobox({
  name = "account_id",
  value,
  accounts,
  placeholder = "Rechercher un compte...",
}: {
  name?: string;
  value?: string | null;
  accounts: ChartOfAccountOption[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(value ?? "");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return accounts.slice(0, 80);
    return accounts
      .filter((account) => `${account.account_number} ${account.account_name}`.toLowerCase().includes(normalized))
      .slice(0, 80);
  }, [accounts, query]);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selected} />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
      />
      <div className="max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-[var(--muted)]">Aucun compte trouve.</div>
        ) : filtered.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => {
              setSelected(account.id);
              setQuery(`${account.account_number} - ${account.account_name}`);
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-[var(--surface-soft)] ${selected === account.id ? "bg-[var(--primary-soft)] text-[var(--secondary)]" : ""}`}
          >
            <span className="font-mono font-medium">{account.account_number}</span>
            <span className="truncate text-[var(--muted)]">{account.account_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
