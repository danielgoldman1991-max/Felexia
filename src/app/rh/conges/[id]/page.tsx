import Link from "next/link";
import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatusBadge } from "@/components/erp/status-badge";
import { Button } from "@/components/ui/button";
import { HrManagementAction } from "@/components/hr/hr-management-action";
import { requireHrWorkspace } from "@/lib/hr/access";
import { decideHrLeaveAction } from "@/lib/hr/leave-actions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HrLeaveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("hr_leave_requests")
    .select("id, employee_id, leave_type_id, start_date, end_date, days_count, reason, status, rejected_reason, approved_at")
    .eq("organization_id", workspace.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("La demande de congé ne peut pas être chargée.");
  if (!request) notFound();
  const [{ data: employee }, { data: leaveType }, history] = await Promise.all([
    supabase.from("hr_employees").select("id, full_name, employee_number").eq("organization_id", workspace.organization.id).eq("id", request.employee_id).maybeSingle(),
    supabase.from("hr_leave_types").select("name, is_paid").eq("organization_id", workspace.organization.id).eq("id", request.leave_type_id).maybeSingle(),
    supabase.from("hr_leave_decisions").select("id, decision, previous_status, next_status, comment, created_at").eq("organization_id", workspace.organization.id).eq("leave_request_id", id).order("created_at", { ascending: false }),
  ]);
  const pending = request.status === "pending";
  const approved = request.status === "approved";
  return (
    <ModulePage>
      <PageHeader
        title="Demande de congé"
        description={`${formatDate(request.start_date)} → ${formatDate(request.end_date)} · ${request.days_count} jour(s)`}
        actions={<Link href="/rh/conges" className="text-sm font-medium text-[var(--primary)] hover:underline">Toutes les demandes</Link>}
      />
      <div className="premium-card grid gap-5 p-5 sm:grid-cols-2">
        <div><p className="text-sm text-[var(--muted)]">Salarié</p><p className="mt-1 font-medium">{employee ? <Link className="text-[var(--primary)] hover:underline" href={`/rh/employes/${employee.id}`}>{employee.full_name}</Link> : "Dossier indisponible"}</p></div>
        <div><p className="text-sm text-[var(--muted)]">Statut</p><p className="mt-1"><StatusBadge status={request.status} /></p></div>
        <div><p className="text-sm text-[var(--muted)]">Type</p><p className="mt-1 font-medium">{leaveType?.name ?? "Type inconnu"}{leaveType?.is_paid === false ? " · non décompté du solde" : ""}</p></div>
        <div><p className="text-sm text-[var(--muted)]">Motif</p><p className="mt-1 font-medium">{request.reason || "Non renseigné"}</p></div>
        {request.rejected_reason ? <div className="sm:col-span-2"><p className="text-sm text-[var(--muted)]">Commentaire de décision</p><p className="mt-1 font-medium">{request.rejected_reason}</p></div> : null}
      </div>
      {pending || approved ? (
        <HrManagementAction>
          <form action={decideHrLeaveAction} className="mt-4 grid max-w-3xl gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5">
            <input type="hidden" name="request_id" value={request.id} />
            <label className="space-y-1 text-sm">
              <span className="font-medium">Commentaire</span>
              <textarea name="comment" rows={2} className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2" placeholder={pending ? "Motif du refus, le cas échéant" : "Motif d'annulation"} />
            </label>
            <div className="flex flex-wrap gap-2">
              {pending ? <Button name="decision" value="approve">Accepter</Button> : null}
              {pending ? <Button name="decision" value="reject" variant="secondary">Refuser</Button> : null}
              <Button name="decision" value="cancel" variant="ghost">Annuler la demande</Button>
            </div>
            <p className="text-sm text-[var(--muted)]">L&apos;acceptation décompte le solde des congés payés. Le refus le laisse inchangé. L&apos;annulation d&apos;un congé déjà accepté recrédite les jours.</p>
          </form>
        </HrManagementAction>
      ) : null}
      <section className="mt-6">
        <h2 className="font-semibold">Historique</h2>
        {history.error ? <p className="mt-2 text-sm text-[var(--muted)]">L&apos;historique détaillé sera disponible après la migration 123. La décision reste enregistrée sur la demande.</p> : null}
        {!history.error && (history.data ?? []).length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">Aucune décision enregistrée.</p> : null}
        <ul className="mt-3 space-y-2">
          {(history.data ?? []).map((item) => (
            <li key={item.id} className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3 text-sm">
              <span className="font-medium">{labelDecision(item.decision)}</span> · {item.previous_status} → {item.next_status} · {formatDate(item.created_at)}
              {item.comment ? <span className="mt-1 block text-[var(--muted)]">{item.comment}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </ModulePage>
  );
}

function labelDecision(value: string) {
  if (value === "approve") return "Acceptation";
  if (value === "reject") return "Refus";
  return "Annulation";
}
