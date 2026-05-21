import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { VatDeclarationDetail } from "@/components/comptabilite/tva/vat-declaration-detail";
import { getVatDeclarationById } from "@/lib/tax/vat-declarations";

export const dynamic = "force-dynamic";

export default async function VatDeclarationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const declaration = await getVatDeclarationById(id);
  if (!declaration) notFound();
  return (
    <ModulePage>
      <VatDeclarationDetail declaration={declaration} />
    </ModulePage>
  );
}
