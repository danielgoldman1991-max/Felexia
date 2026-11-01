import { notFound } from "next/navigation";
import { ModulePage } from "@/components/erp/module-page";
import { VatDeclarationDetail } from "@/components/comptabilite/tva/vat-declaration-detail";
import { getVatDeclarationById } from "@/lib/tax/vat-declarations";
import { requireActiveWorkspace } from "@/lib/auth";
import { canWriteVatWorkspace } from "@/app/comptabilite/tva/access";

export const dynamic = "force-dynamic";

export default async function VatDeclarationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [declaration, workspace] = await Promise.all([getVatDeclarationById(id), requireActiveWorkspace()]);
  if (!declaration) notFound();
  return (
    <ModulePage>
      <VatDeclarationDetail declaration={declaration} canWrite={canWriteVatWorkspace(workspace)} />
    </ModulePage>
  );
}
