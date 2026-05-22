import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export default function HrOnboardingPage() {
  const steps = ["Contrat signé", "CIN", "RIB", "CNSS", "Poste affecté", "Matériel remis", "Accès créés"];
  return (
    <ModulePage>
      <PageHeader title="Onboarding salarié" description="Checklist d'arrivée pour sécuriser le dossier RH et les accès internes." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => <div key={step} className="premium-card p-5"><p className="font-semibold">{step}</p><p className="mt-2 text-sm text-[var(--muted)]">À suivre depuis la fiche employé.</p></div>)}
      </div>
    </ModulePage>
  );
}
