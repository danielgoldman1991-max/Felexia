import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupplierCreditNoteTable } from "@/components/purchases/supplier-credit-note-table";
import { listSupplierCreditNotes } from "@/lib/supplier-credit-notes";
import { requireActiveWorkspace } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/auth/roles";
import { canWriteWorkspaceSubscription } from "@/lib/subscriptions/subscription-access";

export const dynamic = "force-dynamic";

export default async function SupplierCreditNotesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const workspace = await requireActiveWorkspace();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 150) : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const result = await listSupplierCreditNotes({ q, page });
  const canWrite = !isReadOnlyRole(workspace.role) && canWriteWorkspaceSubscription(workspace.subscription);
  function href(nextPage: number) { const sp = new URLSearchParams(); if (q) sp.set("q", q); if (nextPage > 1) sp.set("page", String(nextPage)); return `/achats/avoirs${sp.size ? `?${sp}` : ""}`; }
  return <ModulePage><div className="space-y-5">
    <PageHeader title="Avoirs fournisseurs" description="Enregistrez les avoirs reçus et réduisez le reste à payer de vos factures d’achat." actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><Link href={`/api/exports/supplier-credits?${new URLSearchParams(q ? { q } : {})}`}><Download className="h-4 w-4" />Exporter CSV</Link></Button>{canWrite ? <Button asChild><Link href="/achats/avoirs/new"><Plus className="h-4 w-4" />Nouvel avoir fournisseur</Link></Button> : null}</div>} />
    <form method="get" className="flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><Input aria-label="Rechercher un avoir fournisseur" name="q" defaultValue={q} placeholder="Numéro, référence fournisseur…" className="min-w-40 flex-1" /><Button type="submit" variant="secondary">Rechercher</Button>{q ? <Button variant="ghost" asChild><Link href="/achats/avoirs">Réinitialiser</Link></Button> : null}</form>
    <SupplierCreditNoteTable rows={result.rows} />
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p className="text-[var(--muted)]">{result.total} résultat{result.total > 1 ? "s" : ""} · Page {result.page} sur {result.totalPages}</p><div className="flex gap-2">{result.page > 1 ? <Button variant="secondary" asChild><Link href={href(result.page - 1)}>Précédente</Link></Button> : null}{result.page < result.totalPages ? <Button variant="secondary" asChild><Link href={href(result.page + 1)}>Suivante</Link></Button> : null}</div></div>
  </div></ModulePage>;
}
