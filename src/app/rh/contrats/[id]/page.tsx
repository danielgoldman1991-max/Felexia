import Link from "next/link";
import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { MoneyDisplay } from "@/components/erp/money-display";
import { StatusBadge } from "@/components/erp/status-badge";
import { requireHrWorkspace } from "@/lib/hr/access";
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
    </ModulePage>
  );
}
