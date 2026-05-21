import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { NewVatDeclarationForm } from "@/components/comptabilite/tva/new-vat-declaration-form";

export const dynamic = "force-dynamic";

export default function NewVatDeclarationPage() {
  return (
    <ModulePage>
      <PageHeader
        title="Nouvelle déclaration TVA"
        description="Créez une déclaration TVA préparatoire à partir des factures, paiements et écritures de la période."
        actions={
          <Link href="/comptabilite/tva/declarations">
            <Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Retour</Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Paramètres de la déclaration</h2>
        </CardHeader>
        <CardContent>
          <NewVatDeclarationForm />
        </CardContent>
      </Card>

      <Card className="border-dashed bg-[linear-gradient(180deg,#fff_0%,#fbfcff_100%)]">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
            <FileText className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--foreground)]">Note prudente</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Cette déclaration TVA est une préparation interne Felexia. Le dépôt officiel reste à effectuer selon les modalités DGI/SIMPL applicables.
            </p>
          </div>
        </CardContent>
      </Card>
    </ModulePage>
  );
}
