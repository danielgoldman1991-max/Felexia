import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";

export default function HrAttestationsPage() {
  return (
    <ModulePage>
      <PageHeader title="Attestations RH" description="Attestation de travail, salaire, stage et certificat de travail préparatoire à valider et signer par l'employeur." />
      <HrPreparatoryNotice />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["Attestation de travail", "Attestation de salaire", "Attestation de stage", "Certificat de travail préparatoire"].map((item) => (
          <div key={item} className="premium-card p-5">
            <p className="font-semibold">{item}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Modèle générable depuis la fiche employé.</p>
          </div>
        ))}
      </div>
    </ModulePage>
  );
}
