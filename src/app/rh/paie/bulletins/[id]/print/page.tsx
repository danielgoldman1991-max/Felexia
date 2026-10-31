import { requireActiveWorkspace } from "@/lib/auth";
import { getOrganizationDocumentIdentity } from "@/lib/company-identity";
import { documentIdentityContact, documentIdentityInfoLines } from "@/lib/print-format";
import { PrintActions } from "@/components/sales/print-actions";
import { PrintPage } from "@/components/print/PrintPage";
import { PrintHeader } from "@/components/print/PrintHeader";
import { PrintOrganizationIdentity } from "@/components/print/PrintOrganizationIdentity";
import { PrintDocumentTitle } from "@/components/print/PrintDocumentTitle";
import { PrintTerms } from "@/components/print/PrintTerms";
import { PrintFooter } from "@/components/print/PrintFooter";

export default async function HrPayslipPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await requireActiveWorkspace();
  const identity = await getOrganizationDocumentIdentity(workspace.organization.id);
  const companyContact = documentIdentityContact(identity);
  return (
    <div className="print-preview">
      <PrintActions backHref={`/rh/paie/bulletins/${id}`} backLabel="Retour au bulletin" />
      <PrintPage>
        <PrintHeader>
          <PrintOrganizationIdentity identity={identity} infoLines={documentIdentityInfoLines(identity)} contact={companyContact} />
          <PrintDocumentTitle title="Bulletin préparatoire" documentNumber={id}><p>Document préparatoire</p></PrintDocumentTitle>
        </PrintHeader>
        <PrintTerms title="Préparation du bulletin">
          Bulletin préparatoire généré par Felexia. À compléter et à valider par l’employeur, le comptable ou le conseiller social avant remise.
        </PrintTerms>
        <PrintTerms title="Validation requise">
          Les calculs sociaux et fiscaux sont préparatoires et doivent être validés par votre comptable ou conseiller social selon la réglementation applicable.
        </PrintTerms>
        <PrintFooter footerText={identity.footerText} name={identity.name} contact={companyContact} />
      </PrintPage>
    </div>
  );
}
