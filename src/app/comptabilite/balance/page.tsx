import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function BalancePage() {
  return (
    <ModulePage>
      <PageHeader
        title="Balance des comptes"
        description="Balance generale apres saisie des ecritures."
      />
      <EmptyState
        title="Balance disponible apres validation des ecritures"
        description="La balance synthetise les soldes debiteurs et crediteurs de chaque compte apres validation des ecritures."
        action={<Link href="/comptabilite/ecritures"><Button variant="secondary">Voir les ecritures</Button></Link>}
      />
    </ModulePage>
  );
}
