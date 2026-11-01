import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";

export default function HrOnboardingPage() {
  const steps = ["Contrat signé", "CIN", "RIB", "CNSS", "Poste affecté", "Matériel remis", "Accès créés"];
  return (
    <ModulePage>
      <PageHeader title="Arrivée du salarié · Guide" description="Liste indicative à utiliser avec votre dossier RH. Cet écran ne sauvegarde pas de progression et ne crée aucun accès." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => <div key={step} className="premium-card p-5"><p className="font-semibold">{step}</p><p className="mt-2 text-sm text-[var(--muted)]">Point de contrôle à consigner dans votre dossier salarié.</p></div>)}
      </div>
    </ModulePage>
  );
}
