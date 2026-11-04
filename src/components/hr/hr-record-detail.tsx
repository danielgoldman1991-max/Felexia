import Link from "next/link";
import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { StatusBadge } from "@/components/erp/status-badge";
import { Button } from "@/components/ui/button";
import { HrManagementAction } from "@/components/hr/hr-management-action";
import { requireHrWorkspace } from "@/lib/hr/access";
import { setHrRecordStatusAction } from "@/lib/hr/contract-actions";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function HrRecordDetail({
  id,
  table,
  kind,
  title,
  backHref,
  statuses,
  fields,
}: {
  id: string;
  table: "hr_absences" | "hr_advances" | "hr_loans" | "hr_expense_reports";
  kind: "absence" | "advance" | "loan" | "expense";
  title: string;
  backHref: string;
  statuses: string[];
  fields: Array<{ key: string; label: string }>;
}) {
  if (!uuid.test(id)) notFound();
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("*").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (error) throw new Error("L'enregistrement ne peut pas être chargé.");
  if (!data) notFound();
  const row = data as Record<string, string | number | boolean | null>;
  const { data: employee } = await supabase.from("hr_employees").select("full_name").eq("organization_id", workspace.organization.id).eq("id", String(row.employee_id)).maybeSingle();
  return (
    <ModulePage>
      <PageHeader title={title} description={employee?.full_name ?? "Salarié"} actions={<Link href={backHref} className="text-sm font-medium text-[var(--primary)] hover:underline">Retour à la liste</Link>} />
      <div className="premium-card grid gap-4 p-5 sm:grid-cols-2">
        <div><p className="text-sm text-[var(--muted)]">Statut</p><p className="mt-1"><StatusBadge status={String(row.status ?? "draft")} /></p></div>
        {fields.map((field) => (
          <div key={field.key}><p className="text-sm text-[var(--muted)]">{field.label}</p><p className="mt-1 font-medium">{formatValue(row[field.key])}</p></div>
        ))}
      </div>
      <HrManagementAction>
        <form action={setHrRecordStatusAction} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          {statuses.filter((status) => status !== String(row.status)).map((status) => (
            <Button key={status} name="status" value={status} variant="secondary">{statusLabel(status)}</Button>
          ))}
        </form>
      </HrManagementAction>
      <p className="mt-3 text-sm text-[var(--muted)]">Le changement de statut est interne. Une avance ou une note de frais payée ne crée pas automatiquement un mouvement de trésorerie : enregistrez-le dans Trésorerie si le règlement a lieu.</p>
    </ModulePage>
  );
}

function formatValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Remettre en brouillon",
    validated: "Valider",
    cancelled: "Annuler",
    approved: "Approuver",
    paid: "Marquer payée",
    rejected: "Refuser",
    active: "Réactiver",
    suspended: "Suspendre",
    closed: "Clôturer",
    submitted: "Soumettre",
  };
  return labels[status] ?? status;
}
