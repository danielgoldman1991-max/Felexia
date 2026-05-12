import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function GeneralLedgerPage() {
  return (
    <ModulePage>
      <PageHeader title="Grand livre" description="Grand livre general par compte." />
      <EmptyState
        title="Grand livre disponible apres saisie"
        description="Le grand livre presente l'ensemble des mouvements par compte comptable."
        action={<Link href="/comptabilite/plan-comptable"><Button variant="secondary">Voir le plan comptable</Button></Link>}
      />
    </ModulePage>
  );
}
