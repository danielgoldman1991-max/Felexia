import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function GeneralJournalPage() {
  return (
    <ModulePage>
      <PageHeader title="Journal general" description="Liste chronologique de toutes les ecritures." />
      <EmptyState
        title="Journal general disponible apres saisie"
        description="Le journal general centralise toutes les ecritures comptables par ordre chronologique."
        action={<Link href="/comptabilite/ecritures"><Button variant="secondary">Voir les ecritures</Button></Link>}
      />
    </ModulePage>
  );
}
