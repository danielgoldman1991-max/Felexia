import { UnitForm } from "@/components/articles/unit-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { createUnit } from "@/lib/product-actions";

export default function NewUnitPage() {
  return (
    <ModulePage>
      <PageHeader title="Nouvelle unite" description="Ajouter une unite de mesure ou de quantite." />
      <UnitForm mode="create" action={createUnit} />
    </ModulePage>
  );
}
