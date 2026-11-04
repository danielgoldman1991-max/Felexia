import Link from "next/link";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { requireActiveWorkspace } from "@/lib/auth";
import { listAgendaItems, type AgendaItem } from "@/lib/agenda/echeances";
import { hasFullErpAccess } from "@/lib/launch-access";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { createAgendaTaskAction } from "@/lib/hr/consult-actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function AgendaBoard({ filter }: { filter?: AgendaItem["kind"] | "overdue" }) {
  const workspace = await requireActiveWorkspace();
  const supabase = await createClient();
  const includeHr = await hasFullErpAccess(workspace.organization.id);
  const items = (await listAgendaItems(supabase, workspace.organization.id, includeHr)).filter((item) => {
    if (filter === "overdue") return item.overdue;
    if (filter) return item.kind === filter;
    return true;
  });
  return (
    <ModulePage>
      <PageHeader title={titleFor(filter)} description="Échéances lues dans les factures, et dans les contrats ou congés lorsque l'offre PRO est active. Ce n'est pas un calendrier séparé." />
      <p className="flex flex-wrap gap-3 text-sm">
        <Link className="font-medium text-[var(--primary)]" href="/agenda">Tout</Link>
        <Link className="font-medium text-[var(--primary)]" href="/agenda/echeances">Échéances</Link>
        <Link className="font-medium text-[var(--primary)]" href="/agenda/relances">Retards</Link>
        <Link className="font-medium text-[var(--primary)]" href="/agenda/taches">Tâches</Link>
        <Link className="font-medium text-[var(--primary)]" href="/facturation/relances">Relances clients</Link>
      </p>
      {filter === "tache" || !filter ? (
        <form action={createAgendaTaskAction} className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-4 md:grid-cols-4">
          <label className="text-sm md:col-span-2">Titre<input name="title" required className="mt-1 h-10 w-full rounded border border-[var(--border)] px-2" /></label>
          <label className="text-sm">Échéance<input name="due_date" type="date" required className="mt-1 h-10 w-full rounded border border-[var(--border)] px-2" /></label>
          <div className="flex items-end"><Button type="submit">Ajouter la tâche</Button></div>
          <label className="text-sm md:col-span-4">Tiers lié (identifiant, facultatif)<input name="third_party_id" className="mt-1 h-10 w-full rounded border border-[var(--border)] px-2" placeholder="Laisser vide si la tâche n'est pas liée à un tiers" /></label>
        </form>
      ) : null}
      {items.length === 0 ? <p className="text-sm text-[var(--muted)]">Aucune échéance dans ce filtre.</p> : (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)]">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={item.href} className="font-medium text-[var(--primary)] hover:underline">{item.title}</Link>
                <p className="text-sm text-[var(--muted)]">{item.detail}{item.overdue ? " · en retard" : ""}</p>
              </div>
              <span className="text-sm tabular-nums">{formatDate(item.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </ModulePage>
  );
}

function titleFor(filter?: AgendaItem["kind"] | "overdue") {
  if (filter === "overdue") return "Retards à traiter";
  if (filter === "client") return "Échéances clients";
  if (filter === "fournisseur") return "Échéances fournisseurs";
  if (filter === "tache") return "Tâches";
  if (filter === "fiscal") return "Échéances fiscales";
  return "Agenda";
}
