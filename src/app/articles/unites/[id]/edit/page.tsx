import { notFound } from "next/navigation";
import { UnitForm } from "@/components/articles/unit-form";
import { ModulePage } from "@/components/erp/module-page";
import { PageHeader } from "@/components/erp/page-header";
import { updateUnit } from "@/lib/product-actions";
import { listUnits } from "@/lib/products";

export default async function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const units = await listUnits();
  const unit = units.find((u) => u.id === id);

  if (!unit) {
    notFound();
  }

  return (
    <ModulePage>
      <PageHeader title="Modifier l'unite" description={unit.name} />
      <UnitForm mode="edit" unit={unit} action={updateUnit} />
    </ModulePage>
  );
}
