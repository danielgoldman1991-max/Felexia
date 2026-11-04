import Link from "next/link";
import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { Button } from "@/components/ui/button";
import { HrManagementAction } from "@/components/hr/hr-management-action";
import { requireHrWorkspace } from "@/lib/hr/access";
import { endHrContractAction } from "@/lib/hr/contract-actions";
import { SETTLEMENT_REASONS } from "@/lib/hr/settlement";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HrContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const workspace = await requireHrWorkspace();
  const supabase = await createClient();
  const { data: contract, error } = await supabase.from("hr_contracts").select("id,employee_id,contract_number,contract_type,start_date,end_date,trial_period_end,base_salary,status").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (error) throw new Error("Le contrat ne peut pas être chargé. Veuillez réessayer.");
  if (!contract) notFound();
  const { data: employee, error: employeeError } = await supabase.from("hr_employees").select("id,full_name,employee_number").eq("organization_id", workspace.organization.id).eq("id", contract.employee_id).maybeSingle();
  if (employeeError) throw new Error("Le dossier salarié ne peut pas être chargé. Veuillez réessayer.");
  const salary = Number(contract.base_salary);
  const fields = [
    ["Type de contrat", contract.contract_type || "Non renseigné"],
    ["Date de début", contract.start_date ? formatDate(contract.start_date) : "Non renseignée"],
    ["Date de fin", contract.end_date ? formatDate(contract.end_date) : "Non renseignée"],
    ["Fin de période d’essai", contract.trial_period_end ? formatDate(contract.trial_period_end) : "Non renseignée"],
  ];
  return (
    <ModulePage>
      <PageHeader title={contract.contract_number || "Contrat salarié"} description="Détail du contrat enregistré dans votre entreprise." actions={<Link href="/rh/contrats" className="text-sm font-medium text-[var(--primary)] hover:underline">Tous les contrats</Link>} />
      <div className="premium-card p-5 sm:p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-[var(--muted)]">Salarié</dt><dd className="mt-1 font-medium">{employee ? <Link href={`/rh/employes/${employee.id}`} className="text-[var(--primary)] hover:underline">{employee.full_name}{employee.employee_number ? ` · ${employee.employee_number}` : ""}</Link> : "Dossier indisponible"}</dd></div>
          <div><dt className="text-sm text-[var(--muted)]">Statut</dt><dd className="mt-1"><StatusBadge status={contract.status || "draft"} /></dd></div>
          {fields.map(([label,value]) => <div key={label}><dt className="text-sm text-[var(--muted)]">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
          <div><dt className="text-sm text-[var(--muted)]">Salaire de base</dt><dd className="mt-1 font-medium">{contract.base_salary !== null && Number.isFinite(salary) ? <MoneyDisplay value={salary} /> : "Non renseigné"}</dd></div>
        </dl>
      </div>
      <p className="text-sm text-[var(--muted)]">Cette fiche présente les informations enregistrées. Elle ne remplace pas le document contractuel validé et signé par les parties.</p>
      {contract.status !== "terminated" && contract.status !== "archived" ? (
        <HrManagementAction>
          <form action={endHrContractAction} className="grid max-w-3xl gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 md:grid-cols-2">
            <input type="hidden" name="contract_id" value={contract.id} />
            <h2 className="font-semibold md:col-span-2">Clôturer le contrat</h2>
            <p className="text-sm text-[var(--muted)] md:col-span-2">La clôture passe le salarié en sortie, fige la date de fin et prépare un solde de tout compte imprimable. Le calcul est une aide, pas une décision juridique.</p>
            <label className="space-y-1 text-sm"><span className="font-medium">Date de sortie</span><input name="exit_date" type="date" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Motif</span><select name="reason" required className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3">{SETTLEMENT_REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Jours de préavis</span><input name="notice_days" type="number" min="0" step="0.5" defaultValue="0" className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">Jours travaillés du dernier mois</span><input name="days_worked" type="number" min="0" max="31" step="0.5" defaultValue="0" className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3" /></label>
            <label className="flex items-center gap-2 text-sm md:mt-7"><input name="notice_paid" type="checkbox" /> Préavis exécuté ou payé</label>
            <label className="space-y-1 text-sm md:col-span-2"><span className="font-medium">Note interne</span><textarea name="notes" rows={2} className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2" /></label>
            <div className="md:col-span-2 flex justify-end"><Button type="submit">Enregistrer la fin de contrat</Button></div>
          </form>
        </HrManagementAction>
      ) : <p className="text-sm text-[var(--muted)]">Contrat clos. Le solde de tout compte, s&apos;il a été préparé, est disponible dans Départ.</p>}
    </ModulePage>
  );
}
