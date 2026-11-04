import { ModulePage } from "@/components/erp/module-page";
import { ModuleUpgradePage } from "@/components/erp/module-upgrade-page";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintFooter } from "@/components/print/PrintFooter";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintLineTable } from "@/components/print/PrintLineTable";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintTerms } from "@/components/print/PrintTerms";
import { requireActiveWorkspace } from "@/lib/auth";
import { buildLiasse } from "@/lib/accounting/liasse";
import { loadAccountingLines } from "@/lib/accounting/entry-lines";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { hasFullErpAccess } from "@/lib/launch-access";
import { documentIdentityContact, documentIdentityInfoLines } from "@/lib/print-format";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LiassePrintPage() {
  const workspace = await requireActiveWorkspace();
  if (!(await hasFullErpAccess(workspace.organization.id))) return <ModulePage><ModuleUpgradePage /></ModulePage>;
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);
  const supabase = await createClient();
  const loaded = await loadAccountingLines(supabase, workspace.organization.id);
  const liasse = buildLiasse((loaded.rows ?? []).map((line) => ({ accountCode: line.accountCode, debit: line.debit, credit: line.credit })), 0);
  return (
    <div className="print-preview">
      <PrintActions backHref="/comptabilite/liasse" backLabel="Retour à la liasse" />
      <PrintPage orientation="landscape">
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={documentIdentityInfoLines(identity)} contact={documentIdentityContact(identity)} />
          <PrintDocumentTitle title="Liasse de gestion" documentNumber={identity.name}>
            <p>Actif {formatMoney(liasse.bilan.actif)} · Passif {formatMoney(liasse.bilan.passif)} · Résultat {formatMoney(liasse.cpc.resultat)}</p>
          </PrintDocumentTitle>
        </PrintHeader>
        <PrintLineTable currency="MAD" head={<><th>Section</th><th>Poste</th><th className="right">Montant</th></>}>
          {liasse.postes.map((poste) => (
            <tr key={`${poste.section}-${poste.code}`}><td>{poste.section}</td><td>{poste.code} {poste.label}</td><td className="right">{formatMoney(poste.amount)}</td></tr>
          ))}
        </PrintLineTable>
        <PrintTerms title="Limite">Document de gestion établi à partir des écritures enregistrées. Les capitaux d&apos;ouverture ne sont pas repris d&apos;un bilan N-1 certifié. Ce n&apos;est pas une liasse fiscale déposée.</PrintTerms>
        <PrintFooter name={identity.name} footerText="Liasse de gestion · MAD" />
      </PrintPage>
    </div>
  );
}
