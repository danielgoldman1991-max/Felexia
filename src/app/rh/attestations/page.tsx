import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";

export default function HrAttestationsPage() {
  return (
    <ModulePage>
      <PageHeader title="Attestations RH · À venir" description="Le générateur d’attestations n’est pas encore disponible. Ces catégories présentent les documents envisagés." />
      <HrPreparatoryNotice />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["Attestation de travail", "Attestation de salaire", "Attestation de stage", "Certificat de travail préparatoire"].map((item) => (
          <div key={item} className="premium-card p-5">
            <p className="font-semibold">{item}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Génération à venir. Aucun document n’est créé depuis cet écran.</p>
          </div>
        ))}
      </div>
    </ModulePage>
  );
}
