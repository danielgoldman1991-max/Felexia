"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useActionState } from "react";
import { Table, Td, Th } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/erp/empty-state";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_CLASS_LABELS, ACCOUNT_CLASS_OPTIONS, ACCOUNT_TYPE_OPTIONS, type AccountingAccountRecord } from "@/lib/accounting-types";
import { toggleChartOfAccountActive, archiveChartOfAccount } from "@/lib/accounting-actions";
import { Search, X, ChevronLeft, ChevronRight, Eye, Pencil, Archive, ToggleLeft, ToggleRight } from "lucide-react";

function ToggleActiveForm({ accountId, isActive }: { accountId: string; isActive: boolean }) {
  const [, formAction] = useActionState(toggleChartOfAccountActive, { success: false });
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={accountId} />
      <button
        type="submit"
        className="text-[var(--muted)] hover:text-[var(--foreground)]"
        title={isActive ? "Desactiver" : "Activer"}
      >
        {isActive ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
      </button>
    </form>
  );
}

function ArchiveForm({ accountId }: { accountId: string }) {
  const [, formAction] = useActionState(archiveChartOfAccount, { success: false });
  return (
    <form action={formAction} onSubmit={(e) => {
      if (!confirm("Archiver ce compte ? Il sera masque du plan comptable.")) e.preventDefault();
    }}>
      <input type="hidden" name="id" value={accountId} />
      <button
        type="submit"
        className="text-[var(--muted)] hover:text-[var(--danger)]"
        title="Archiver"
      >
        <Archive className="h-4 w-4" />
      </button>
    </form>
  );
}

export function AccountsTable({ rows }: { rows: AccountingAccountRecord[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Aucun compte" description="Le plan comptable sera disponible apres initialisation." />;
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Compte</Th>
          <Th>Intitule</Th>
          <Th>Classe</Th>
          <Th>Type</Th>
          <Th>Parent</Th>
          <Th>Auxiliaire</Th>
          <Th>Statut</Th>
          <Th>Actions</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--surface-soft)]">
            <Td><span className="font-mono text-sm font-medium">{row.code}</span></Td>
            <Td className="max-w-[240px] truncate">
              {row.parent_account_id ? <span className="mr-1 text-[var(--muted)]">-- </span> : null}
              {row.name}
            </Td>
            <Td><Badge tone="info">{ACCOUNT_CLASS_LABELS[row.class_number] ?? row.class_number}</Badge></Td>
            <Td><span className="text-xs text-[var(--muted)]">{ACCOUNT_TYPE_LABELS[row.type] ?? row.type}</span></Td>
            <Td className="text-xs text-[var(--muted)]">{row.parent_code ?? "-"}</Td>
            <Td>{row.is_auxiliary ? <Badge tone="warning">Auxiliaire</Badge> : <span className="text-xs text-[var(--muted)]">General</span>}</Td>
            <Td>
              {row.is_active
                ? <Badge tone="success">Actif</Badge>
                : <Badge tone="danger">Inactif</Badge>}
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <Link href={`/comptabilite/plan-comptable/${row.id}`} className="text-indigo-700 hover:text-indigo-900" title="Voir"><Eye className="h-4 w-4" /></Link>
                <Link href={`/comptabilite/plan-comptable/${row.id}/edit`} className="text-indigo-700 hover:text-indigo-900" title="Modifier"><Pencil className="h-4 w-4" /></Link>
                <ToggleActiveForm accountId={row.id} isActive={row.is_active} />
                <ArchiveForm accountId={row.id} />
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function ChartOfAccountFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function reset() {
    router.push(pathname);
  }

  const hasFilters = Array.from(sp.entries()).some(([k]) => k !== "page");

  return (
    <div className="mb-6 space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Recherche</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Numero ou intitule..."
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgb(124_79_242_/_16%)]"
              value={sp.get("q") ?? ""}
              onChange={(e) => setParam("q", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Classe</label>
          <Select value={sp.get("account_class") ?? ""} onChange={(e) => setParam("account_class", e.target.value)}>
            <option value="">Toutes les classes</option>
            {ACCOUNT_CLASS_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Type</label>
          <Select value={sp.get("account_type") ?? ""} onChange={(e) => setParam("account_type", e.target.value)}>
            <option value="">Tous les types</option>
            {ACCOUNT_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Statut</label>
          <Select value={sp.get("is_active") ?? ""} onChange={(e) => setParam("is_active", e.target.value)}>
            <option value="">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Auxiliaire</label>
          <Select value={sp.get("is_auxiliary") ?? ""} onChange={(e) => setParam("is_auxiliary", e.target.value)}>
            <option value="">Tous</option>
            <option value="0">Generaux</option>
            <option value="1">Auxiliaires</option>
          </Select>
        </div>
      </div>
      {hasFilters && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--muted)]">{total} compte{total > 1 ? "s" : ""}</p>
          <Button variant="ghost" onClick={reset}><X className="h-4 w-4" /> Effacer les filtres</Button>
        </div>
      )}
    </div>
  );
}

export function PaginationBar({ page, totalPages, total }: { page: number; totalPages: number; total: number }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  function href(p: number) {
    const next = new URLSearchParams(sp);
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-[var(--muted)]">Page {page} sur {totalPages} ({total} resultats)</p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)}><Button variant="secondary"><ChevronLeft className="h-4 w-4" /> Precedente</Button></Link>
        ) : null}
        {page < totalPages ? (
          <Link href={href(page + 1)}><Button variant="secondary">Suivante <ChevronRight className="h-4 w-4" /></Button></Link>
        ) : null}
      </div>
    </div>
  );
}