import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { EmptyState } from "@/components/erp/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BankStatementImportsPage() {
  return (
    <ModulePage>
      <PageHeader
        title="Releves bancaires"
        description="Imports de releves bancaires et rapprochement automatique."
      />
      <EmptyState
        title="Releves bancaires bientot disponibles"
        description="Ce sous-module est temporairement masque. Utilisez le rapprochement bancaire ou suivez vos mouvements depuis la tresorerie."
        action={
          <Button asChild><Link href="/tresorerie"><ArrowLeft className="h-4 w-4" /> Retour a la tresorerie</Link></Button>
        }
      />
    </ModulePage>
  );
}
