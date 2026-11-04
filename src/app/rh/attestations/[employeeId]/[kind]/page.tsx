import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintFooter } from "@/components/print/PrintFooter";
import { requireHrWorkspace } from "@/lib/hr/access";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { documentIdentityContact, documentIdentityInfoLines } from "@/lib/print-format";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds = {
  travail: "Attestation de travail",
  salaire: "Attestation de salaire",
  certificat: "Certificat de travail",
} as const;

export const dynamic = "force-dynamic";

export default async function HrCertificatePrintPage({ params }: { params: Promise<{ employeeId: string; kind: string }> }) {
  const { employeeId, kind } = await params;
  if (!uuid.test(employeeId) || !(kind in kinds)) notFound();
  const documentKind = kind as keyof typeof kinds;
  const workspace = await requireHrWorkspace();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);
  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("hr_employees")
    .select("id, full_name, first_name, last_name, employee_number, cin, cnss_number, hire_date, exit_date, employment_status, base_salary, position_id")
    .eq("organization_id", workspace.organization.id)
    .eq("id", employeeId)
    .maybeSingle();
  if (!employee) notFound();
  const [{ data: position }, { data: contract }, { data: slip }] = await Promise.all([
    employee.position_id
      ? supabase.from("hr_positions").select("title").eq("organization_id", workspace.organization.id).eq("id", employee.position_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("hr_contracts").select("contract_type, start_date, end_date, base_salary, status").eq("organization_id", workspace.organization.id).eq("employee_id", employeeId).order("start_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("hr_payslips").select("gross_salary, net_to_pay, net_salary, payroll_period_id, status").eq("organization_id", workspace.organization.id).eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const period = slip?.payroll_period_id
    ? (await supabase.from("hr_payroll_periods").select("month, year").eq("organization_id", workspace.organization.id).eq("id", slip.payroll_period_id).maybeSingle()).data
    : null;
  const company = identity.name || "L'entreprise";
  const job = position?.title || "poste non renseigné";
  const salary = Number(contract?.base_salary ?? employee.base_salary ?? 0);
  const issued = formatDate(new Date().toISOString());
  const body = documentKind === "salaire"
    ? `${company} atteste que ${employee.full_name}, matricule ${employee.employee_number}, CIN ${employee.cin || "non renseignée"}, perçoit un salaire de base de ${formatMoney(salary)}. Le dernier bulletin enregistré indique un brut de ${formatMoney(Number(slip?.gross_salary ?? 0))} et un net de ${formatMoney(Number(slip?.net_to_pay ?? slip?.net_salary ?? 0))}${period ? ` pour ${String(period.month).padStart(2, "0")}/${period.year}` : ""}. Cette attestation reprend les données saisies dans Felexia. Elle ne vaut pas bulletin de paie ni déclaration sociale.`
    : documentKind === "certificat"
      ? `${company} certifie que ${employee.full_name} a occupé le poste de ${job} depuis le ${formatDate(employee.hire_date)}${employee.exit_date ? ` jusqu'au ${formatDate(employee.exit_date)}` : ", et est toujours inscrit dans les effectifs à la date de la présente"}. Le présent certificat est établi pour servir et valoir ce que de droit.`
      : `${company} atteste que ${employee.full_name}, matricule ${employee.employee_number}, CIN ${employee.cin || "non renseignée"}, est ${employee.exit_date ? "inscrit jusqu'au " + formatDate(employee.exit_date) : "employé"} depuis le ${formatDate(employee.hire_date)} en qualité de ${job}${contract?.contract_type ? ` (${contract.contract_type})` : ""}. La présente attestation est délivrée à la demande de l'intéressé pour servir et valoir ce que de droit.`;
  return (
    <div className="print-preview">
      <PrintActions backHref="/rh/attestations" backLabel="Retour aux attestations" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={documentIdentityInfoLines(identity)} contact={documentIdentityContact(identity)} />
          <PrintDocumentTitle title={kinds[documentKind]} documentNumber={employee.employee_number}>
            <p>Établie le {issued}</p>
          </PrintDocumentTitle>
        </PrintHeader>
        <PrintTerms title="Salarié">
          {employee.full_name} · CIN {employee.cin || "—"} · CNSS {employee.cnss_number || "—"} · Entrée {formatDate(employee.hire_date)}
        </PrintTerms>
        <PrintTerms title="Texte">{body}</PrintTerms>
        <PrintTerms title="Mention">
          Document interne établi en dirhams (MAD) à partir du dossier Felexia. Il ne comporte pas de signature qualifiée et n&apos;est transmis à aucun organisme.
        </PrintTerms>
        <PrintFooter name={company} footerText={kinds[documentKind]} />
      </PrintPage>
    </div>
  );
}
