import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { HrPreparatoryNotice } from "@/components/hr/hr-notice";

export default function HrOffboardingPage() {
  const steps = ["Date de départ", "Motif", "Solde de tout compte préparatoire", "Matériel récupéré", "Documents remis", "Accès désactivés"];
  return (
    <ModulePage>
      <PageHeader title="Offboarding salarié" description="Checklist de sortie et préparation des documents de départ." />
      <HrPreparatoryNotice />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => <div key={step} className="premium-card p-5"><p className="font-semibold">{step}</p><p className="mt-2 text-sm text-[var(--muted)]">Contrôle à effectuer avant clôture du dossier.</p></div>)}
      </div>
    </ModulePage>
  );
}
