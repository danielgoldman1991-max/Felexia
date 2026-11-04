import { notFound } from "next/navigation";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintFooter } from "@/components/print/PrintFooter";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintTotals } from "@/components/print/PrintTotals";
import { requireHrWorkspace } from "@/lib/hr/access";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { documentIdentityContact, documentIdentityInfoLines } from "@/lib/print-format";
import { SETTLEMENT_REASONS } from "@/lib/hr/settlement";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SettlementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const workspace = await requireHrWorkspace();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);
  const supabase = await createClient();
  const { data: settlement } = await supabase.from("hr_final_settlements").select("*").eq("organization_id", workspace.organization.id).eq("id", id).maybeSingle();
  if (!settlement) notFound();
  const { data: employee } = await supabase.from("hr_employees").select("full_name, employee_number, cin, hire_date").eq("organization_id", workspace.organization.id).eq("id", settlement.employee_id).maybeSingle();
  const reason = SETTLEMENT_REASONS.find((item) => item.value === settlement.reason)?.label ?? settlement.reason;
  return (
    <div className="print-preview">
      <PrintActions backHref="/rh/offboarding" backLabel="Retour aux départs" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={documentIdentityInfoLines(identity)} contact={documentIdentityContact(identity)} />
          <PrintDocumentTitle title="Solde de tout compte" documentNumber={settlement.settlement_number}>
            <p>Sortie le {formatDate(settlement.exit_date)} · {reason}</p>
          </PrintDocumentTitle>
        </PrintHeader>
        <PrintTerms title="Salarié">
          {employee?.full_name ?? "Salarié"} · {employee?.employee_number ?? "—"} · CIN {employee?.cin || "—"} · Entrée {employee?.hire_date ? formatDate(employee.hire_date) : "—"} · Ancienneté {settlement.years_of_service} an(s)
        </PrintTerms>
        <PrintLineTable currency="MAD" head={<><th>Élément</th><th className="right">Montant</th></>}>
          <tr><td>Dernier net enregistré</td><td className="right">{formatMoney(Number(settlement.last_net))}</td></tr>
          <tr><td>Congés restants ({settlement.leave_days} j)</td><td className="right">{formatMoney(Number(settlement.leave_indemnity))}</td></tr>
          <tr><td>Préavis non exécuté ({settlement.notice_days} j)</td><td className="right">{formatMoney(Number(settlement.notice_indemnity))}</td></tr>
          <tr><td>Indemnité de licenciement préparatoire</td><td className="right">{formatMoney(Number(settlement.dismissal_indemnity))}</td></tr>
        </PrintLineTable>
        <PrintTotals rows={[{ label: "Salaire mensuel de référence", value: formatMoney(Number(settlement.monthly_salary)) }]} grandTotalLabel="Total préparatoire" grandTotalValue={formatMoney(Number(settlement.total_amount))} />
        <PrintTerms title="Réserves">
          Aide au calcul selon les paliers de l&apos;article 53 du Code du travail (96, 144, 192 puis 240 heures par année, heure = salaire / 191, journée de congés et de préavis = salaire / 26). Ce document n&apos;est pas un reçu pour solde de tout compte signé et ne constate aucun paiement.
          {settlement.notes ? ` ${settlement.notes}` : ""}
        </PrintTerms>
        <PrintFooter name={identity.name} footerText="Solde de tout compte préparatoire · MAD" />
      </PrintPage>
    </div>
  );
}
